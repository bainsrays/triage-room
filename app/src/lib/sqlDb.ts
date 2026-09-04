// Runs the SQL Scratchpad's queries inside a dedicated Web Worker
// (public/sqljs/worker-shim.js), which loads sql.js (WASM) lazily — only
// when the scratchpad is opened, not on initial page load. Using a worker
// gives us a *real* 5-second timeout: sql.js's exec() is synchronous and
// cannot be interrupted from within the same thread, so the only reliable
// way to enforce a timeout is to run it somewhere we can `terminate()`.
//
// Each ticket ships its own `tools.sql_scratchpad` object with the exact
// shape `{ table, schema, rows, suggested_queries }` — a single table scoped
// to that incident's evidence (e.g. INC-2101 -> `transactions`, INC-2110 ->
// `crypto_deposits`). We seed sql.js directly from that, rather than
// re-deriving a table from other tool panels, so the scratchpad's schema
// always matches what the content actually authored.
import type { Ticket } from "../types/ticket";
import { SQL_ROW_CAP, SQL_TIMEOUT_MS } from "./sqlGuard";

export interface SeededTableInfo {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SuggestedQuery {
  query: string;
  result_summary: string;
}

interface RawSqlScratchpad {
  table?: string;
  schema?: string[];
  rows?: Record<string, unknown>[];
  suggested_queries?: SuggestedQuery[];
}

/** Extracts this ticket's single seeded table + suggested queries from `tools.sql_scratchpad`. */
export function extractSeedTables(ticket: Ticket): { tables: SeededTableInfo[]; suggestedQueries: SuggestedQuery[] } {
  const raw = ticket.tools.sql_scratchpad as RawSqlScratchpad | undefined;
  if (!raw || !raw.table || !Array.isArray(raw.schema) || !Array.isArray(raw.rows)) {
    return { tables: [], suggestedQueries: [] };
  }
  const tableName = raw.table.replace(/[^a-zA-Z0-9_]/g, "_");
  return {
    tables: [{ name: tableName, columns: raw.schema, rows: raw.rows }],
    suggestedQueries: raw.suggested_queries ?? [],
  };
}

export interface SqlRunResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
}

export type SqlRunOutcome = { ok: true; result: SqlRunResult } | { ok: false; error: string };

let worker: Worker | null = null;
let msgCounter = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/sqljs/worker-shim.js");
  }
  return worker;
}

function resetWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/**
 * Runs a single pre-validated (evaluateSqlQuery-approved) SELECT against the
 * ticket's seeded tables inside a Web Worker, capping rows client-side and
 * enforcing a hard 5-second timeout by terminating the worker if it doesn't
 * respond in time.
 */
export function runSqlQuery(tables: SeededTableInfo[], sql: string): Promise<SqlRunOutcome> {
  return new Promise((resolve) => {
    const id = ++msgCounter;
    const w = getWorker();
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resetWorker();
      resolve({ ok: false, error: `Query timed out after ${SQL_TIMEOUT_MS / 1000}s.` });
    }, SQL_TIMEOUT_MS);

    function onMessage(e: MessageEvent) {
      if (e.data?.id !== id || settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      w.removeEventListener("message", onMessage);
      if (e.data.ok) {
        resolve({
          ok: true,
          result: {
            columns: e.data.columns,
            rows: e.data.rows,
            rowCount: e.data.rowCount,
            truncated: e.data.truncated,
            elapsedMs: e.data.elapsedMs,
          },
        });
      } else {
        resolve({ ok: false, error: e.data.error ?? "Unknown SQL error." });
      }
    }

    w.addEventListener("message", onMessage);
    w.postMessage({ id, type: "run", tables, sql, rowCap: SQL_ROW_CAP });
  });
}
