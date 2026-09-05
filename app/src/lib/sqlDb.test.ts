import { describe, expect, it } from "vitest";
import { extractSeedTables, quoteSqlIdentifier } from "./sqlDb";
import type { Ticket } from "../types/ticket";

describe("SQL seed identifiers", () => {
  it("preserves authored table and column names during extraction", () => {
    const ticket = {
      tools: {
        sql_scratchpad: {
          table: '3ds "history"',
          schema: ["3ds_result", "a-b", "a_b"],
          rows: [{ "3ds_result": "AUTHENTICATED", "a-b": "first", a_b: "second" }],
          suggested_queries: [],
        },
      },
    } as unknown as Ticket;
    expect(extractSeedTables(ticket).tables).toEqual([{
      name: '3ds "history"',
      columns: ["3ds_result", "a-b", "a_b"],
      rows: [{ "3ds_result": "AUTHENTICATED", "a-b": "first", a_b: "second" }],
    }]);
  });

  it.each([
    ["transactions", '"transactions"'],
    ["3ds_result", '"3ds_result"'],
    ['order "history"', '"order ""history"""'],
  ])("quotes %s for generated queries", (name, expected) => {
    expect(quoteSqlIdentifier(name)).toBe(expected);
  });
});
