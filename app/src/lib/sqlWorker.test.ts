import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import type { SqlJsStatic } from "sql.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { extractSeedTables, type SeededTableInfo } from "./sqlDb";
import type { Ticket } from "../types/ticket";

const publicDirectory = new URL("../../public/sqljs/", import.meta.url);
const workerSource = readFileSync(new URL("worker-shim.js", publicDirectory), "utf8");
let SQL: SqlJsStatic;
const cleanup: (() => void)[] = [];

beforeAll(async () => {
  const runtime = createContext({
    require: createRequire(import.meta.url), module: { exports: {} }, exports: {},
    __dirname: fileURLToPath(publicDirectory), process, Buffer, console, WebAssembly, setTimeout, clearTimeout, TextDecoder, TextEncoder,
  });
  runInContext(readFileSync(new URL("sql-wasm.js", publicDirectory), "utf8"), runtime);
  SQL = await runtime.initSqlJs({ wasmBinary: readFileSync(new URL("sql-wasm.wasm", publicDirectory)) });
});

afterEach(() => { cleanup.splice(0).forEach((close) => close()); });

interface WorkerReply {
  id: number;
  ok: boolean;
  columns?: string[];
  rows?: unknown[][];
  rowCount?: number;
  truncated?: boolean;
  error?: string;
}

function harness() {
  const databases: { close: ReturnType<typeof vi.spyOn> }[] = [];
  const createDatabase = vi.fn(function () {
    const database = new SQL.Database();
    const close = vi.spyOn(database, "close");
    databases.push({ close });
    cleanup.push(() => { if (!close.mock.calls.length) database.close(); });
    return database;
  });
  const initialize = vi.fn(async () => ({ Database: createDatabase }));
  const pending = new Map<number, (reply: WorkerReply) => void>();
  const scope = {
    initSqlJs: initialize,
    postMessage(reply: WorkerReply) {
      pending.get(reply.id)?.(reply);
      pending.delete(reply.id);
    },
    onmessage: undefined as unknown as (event: { data: unknown }) => void,
  };
  runInContext(workerSource, createContext({ self: scope, importScripts: vi.fn(), performance }));
  let nextId = 0;
  return {
    databases, createDatabase, initialize,
    run(tables: SeededTableInfo[], sql: string, rowCap = 500) {
      const id = ++nextId;
      return new Promise<WorkerReply>((resolve) => {
        pending.set(id, resolve);
        scope.onmessage({ data: structuredClone({ id, type: "run", tables, sql, rowCap }) });
      });
    },
  };
}

function seed(incident: string, name = "transactions"): SeededTableInfo[] {
  return [{ name, columns: ["incident"], rows: [{ incident }] }];
}

describe("SQL worker seed lifecycle (real shipped sql.js)", () => {
  it("executes every authored suggested query against its incident", async () => {
    const worker = harness();
    const { tickets } = JSON.parse(readFileSync(new URL("../../../content/tickets.json", import.meta.url), "utf8")) as { tickets: Ticket[] };
    for (const ticket of tickets) {
      const { tables, suggestedQueries } = extractSeedTables(ticket);
      for (const suggestion of suggestedQueries) {
        const result = await worker.run(tables, suggestion.query);
        expect(result.ok, `${ticket.id}: ${suggestion.query}: ${result.error}`).toBe(true);
      }
    }
  });

  it("switches A -> B -> A when only incident rows change and closes old databases", async () => {
    const worker = harness();
    for (const incident of ["A", "B", "A"]) {
      expect(await worker.run(seed(incident), "SELECT * FROM transactions")).toMatchObject({ ok: true, rows: [[incident]] });
    }
    expect(worker.createDatabase).toHaveBeenCalledTimes(3);
    expect(worker.databases.map(({ close }) => close.mock.calls.length)).toEqual([1, 1, 0]);
  });

  it("switches A -> B -> A across different tables without leaking the previous table", async () => {
    const worker = harness();
    for (const [incident, table, absent] of [
      ["A", "transactions", "crypto_deposits"],
      ["B", "crypto_deposits", "transactions"],
      ["A", "transactions", "crypto_deposits"],
    ]) {
      expect(await worker.run(seed(incident, table), `SELECT * FROM ${table}`)).toMatchObject({ ok: true, rows: [[incident]] });
      expect(await worker.run(seed(incident, table), `SELECT * FROM ${absent}`)).toMatchObject({
        ok: false, error: expect.stringContaining("no such table"),
      });
    }
  });

  it("reuses an identical seed across reruns without duplicating rows", async () => {
    const worker = harness();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await worker.run(seed("A"), "SELECT * FROM transactions")).toMatchObject({ ok: true, rows: [["A"]], rowCount: 1 });
    }
    expect(worker.createDatabase).toHaveBeenCalledTimes(1);
    expect(worker.databases[0].close).not.toHaveBeenCalled();
  });

  it("rebuilds when columns or additional tables change", async () => {
    const worker = harness();
    await worker.run(seed("A"), "SELECT * FROM transactions");
    const changed = [{ name: "transactions", columns: ["status"], rows: [{ status: "pending" }] }];
    expect(await worker.run(changed, "SELECT status FROM transactions")).toMatchObject({ ok: true, rows: [["pending"]] });
    expect(await worker.run([...changed, ...seed("B", "deposits")], "SELECT * FROM deposits")).toMatchObject({ ok: true, rows: [["B"]] });
    expect(worker.createDatabase).toHaveBeenCalledTimes(3);
  });

  it("initializes INC-2107 and preserves its digit-leading column", async () => {
    const ticket = JSON.parse(readFileSync(new URL("../../../content/tickets/2107.json", import.meta.url), "utf8")) as Ticket;
    const { tables } = extractSeedTables(ticket);
    expect(await harness().run(tables, 'SELECT reference, "3ds_result" FROM transactions')).toMatchObject({
      ok: true, columns: ["reference", "3ds_result"], rows: [["TRX-772A01", "AUTHENTICATED (frictionless)"]],
    });
  });

  it("quotes table and column identifiers without renaming or losing literal values", async () => {
    const tables = [{
      name: 'order "history"', columns: ["select", 'a"b', "a-b", "a_b"],
      rows: [{ select: "O'Brien", 'a"b': "quoted", "a-b": null, a_b: 42 }],
    }];
    expect(await harness().run(tables, 'SELECT * FROM "order ""history"""')).toMatchObject({
      ok: true, columns: tables[0].columns, rows: [["O'Brien", "quoted", null, 42]],
    });
  });

  it("closes partially seeded databases and recovers after repeated initialization failure", async () => {
    const worker = harness();
    const invalid = [...seed("A"), ...seed("B")];
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await worker.run(invalid, "SELECT * FROM transactions")).toMatchObject({ ok: false });
    }
    expect(worker.createDatabase).toHaveBeenCalledTimes(2);
    expect(worker.databases.map(({ close }) => close.mock.calls.length)).toEqual([1, 1]);
    expect(await worker.run(seed("recovered"), "SELECT * FROM transactions")).toMatchObject({ ok: true, rows: [["recovered"]] });
  });

  it("does not serve a stale database when a replacement seed fails", async () => {
    const worker = harness();
    await worker.run(seed("A"), "SELECT * FROM transactions");
    expect(await worker.run([...seed("B"), ...seed("C")], "SELECT * FROM transactions")).toMatchObject({ ok: false });
    expect(worker.databases.map(({ close }) => close.mock.calls.length)).toEqual([1, 1]);
    expect(await worker.run(seed("A"), "SELECT * FROM transactions")).toMatchObject({ ok: true, rows: [["A"]] });
  });

  it("retries the same seed after the SQL runtime fails to initialize", async () => {
    const worker = harness();
    worker.initialize.mockRejectedValueOnce(new Error("WASM unavailable"));
    expect(await worker.run(seed("A"), "SELECT * FROM transactions")).toMatchObject({ ok: false, error: "WASM unavailable" });
    expect(await worker.run(seed("A"), "SELECT * FROM transactions")).toMatchObject({ ok: true, rows: [["A"]] });
  });

  it("serializes concurrent A -> B -> A initialization and queries", async () => {
    const worker = harness();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    worker.initialize.mockImplementationOnce(async () => {
      await gate;
      return { Database: worker.createDatabase };
    });
    const runs = ["A", "B", "A"].map((incident) => worker.run(seed(incident), "SELECT * FROM transactions"));
    release();
    const replies = await Promise.all(runs);
    expect(replies.map(({ ok, rows }) => ({ ok, rows }))).toEqual(
      ["A", "B", "A"].map((incident) => ({ ok: true, rows: [[incident]] }))
    );
    expect(worker.databases.map(({ close }) => close.mock.calls.length)).toEqual([1, 1, 0]);
  });

  it("shares initialization for concurrent identical seeds and survives a queued failure", async () => {
    const worker = harness();
    const replies = await Promise.all([
      worker.run(seed("A"), "SELECT * FROM transactions"),
      worker.run(seed("A"), "SELECT * FROM transactions"),
      worker.run([...seed("B"), ...seed("C")], "SELECT * FROM transactions"),
      worker.run(seed("D", "deposits"), "SELECT * FROM deposits"),
    ]);
    expect(replies.map(({ ok }) => ok)).toEqual([true, true, false, true]);
    expect(replies[3].rows).toEqual([["D"]]);
    expect(worker.createDatabase).toHaveBeenCalledTimes(3);
  });

  it("keeps row caps and recovers from query errors without rebuilding", async () => {
    const worker = harness();
    const tables = [{ name: "transactions", columns: ["incident"], rows: [{ incident: "A" }, { incident: "B" }] }];
    expect(await worker.run(tables, "SELECT * FROM missing")).toMatchObject({ ok: false });
    expect(await worker.run(tables, "SELECT * FROM transactions ORDER BY incident", 1)).toMatchObject({
      ok: true, rows: [["A"]], rowCount: 2, truncated: true,
    });
    expect(worker.createDatabase).toHaveBeenCalledTimes(1);
  });
});
