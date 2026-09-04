import { describe, expect, it } from "vitest";
import { evaluateSqlQuery, stripSqlComments } from "./sqlGuard";

describe("evaluateSqlQuery — allowed queries", () => {
  it("allows a plain SELECT", () => {
    const r = evaluateSqlQuery("SELECT * FROM transactions WHERE customer_id = 'CUS-1'");
    expect(r.allowed).toBe(true);
  });

  it("allows a SELECT with a trailing semicolon", () => {
    const r = evaluateSqlQuery("SELECT reference, status FROM transactions;");
    expect(r.allowed).toBe(true);
  });

  it("allows a WITH ... SELECT CTE", () => {
    const r = evaluateSqlQuery("WITH recent AS (SELECT * FROM transactions) SELECT * FROM recent");
    expect(r.allowed).toBe(true);
  });

  it("allows lowercase select", () => {
    const r = evaluateSqlQuery("select * from transactions");
    expect(r.allowed).toBe(true);
  });

  it("is not fooled by forbidden-looking words inside string literals", () => {
    const r = evaluateSqlQuery("SELECT * FROM notes WHERE body = 'please drop by the office'");
    expect(r.allowed).toBe(true);
  });
});

describe("evaluateSqlQuery — rejected queries", () => {
  it("rejects DROP TABLE", () => {
    const r = evaluateSqlQuery("DROP TABLE transactions");
    expect(r.allowed).toBe(false);
  });

  it("rejects UPDATE", () => {
    const r = evaluateSqlQuery("UPDATE transactions SET status = 'SUCCESS' WHERE reference = 'TRX-1'");
    expect(r.allowed).toBe(false);
  });

  it("rejects DELETE", () => {
    const r = evaluateSqlQuery("DELETE FROM transactions");
    expect(r.allowed).toBe(false);
  });

  it("rejects PRAGMA", () => {
    const r = evaluateSqlQuery("PRAGMA table_info(transactions)");
    expect(r.allowed).toBe(false);
  });

  it("rejects ATTACH DATABASE", () => {
    const r = evaluateSqlQuery("ATTACH DATABASE 'x.db' AS x");
    expect(r.allowed).toBe(false);
  });

  it("rejects stacked statements via semicolon injection", () => {
    const r = evaluateSqlQuery("SELECT * FROM transactions; DROP TABLE transactions;--");
    expect(r.allowed).toBe(false);
  });

  it("rejects a comment-hidden second statement", () => {
    const r = evaluateSqlQuery("SELECT 1 -- \nDROP TABLE transactions");
    // after stripping the line comment this becomes "SELECT 1 \nDROP TABLE transactions"
    // which still contains a forbidden keyword and is correctly rejected.
    expect(r.allowed).toBe(false);
  });

  it("rejects INSERT", () => {
    const r = evaluateSqlQuery("INSERT INTO transactions VALUES (1,2,3)");
    expect(r.allowed).toBe(false);
  });

  it("rejects an empty query", () => {
    const r = evaluateSqlQuery("   ");
    expect(r.allowed).toBe(false);
  });

  it("rejects a query that isn't a SELECT/WITH at all", () => {
    const r = evaluateSqlQuery("EXPLAIN SELECT * FROM transactions");
    expect(r.allowed).toBe(false);
  });
});

describe("stripSqlComments", () => {
  it("removes line comments", () => {
    expect(stripSqlComments("SELECT 1 -- comment here\nSELECT 2")).toBe("SELECT 1 \nSELECT 2");
  });
  it("removes block comments", () => {
    expect(stripSqlComments("SELECT /* x */ 1")).toBe("SELECT  1");
  });
});
