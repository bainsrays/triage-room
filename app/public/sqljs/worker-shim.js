// Runs inside a dedicated Web Worker. Loads sql.js, builds a table from the
// seed payload it's given, then executes a single pre-validated SELECT and
// posts the result back. This gives the SQL Scratchpad a real 5-second
// timeout: if the worker doesn't respond in time, the main thread terminates
// it outright (a synchronous sql.js exec() cannot otherwise be interrupted).
importScripts("/sqljs/sql-wasm.js");

let cachedDb = null;
let cachedSeed = null;
let runQueue = Promise.resolve();

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function quoteIdentifier(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

function inferColumnType(values) {
  if (values.every((v) => v === null || v === undefined || typeof v === "number")) return "REAL";
  return "TEXT";
}

async function getDb(tables) {
  const seed = JSON.stringify(tables);
  if (cachedDb && cachedSeed === seed) return cachedDb;
  const previousDb = cachedDb;
  cachedDb = null;
  cachedSeed = null;
  if (previousDb) previousDb.close();

  const SQL = await self.initSqlJs({ locateFile: (file) => "/sqljs/" + file });
  const db = new SQL.Database();
  try {
    for (const t of tables) {
      const tableName = quoteIdentifier(t.name);
      const columns = t.columns.map(quoteIdentifier);
      const columnTypes = columns.map((_, i) => inferColumnType(t.rows.map((r) => r[t.columns[i]])));
      db.run(
        "CREATE TABLE " +
          tableName +
          " (" +
          columns.map((c, i) => c + " " + columnTypes[i]).join(", ") +
          ");"
      );
      for (const row of t.rows) {
        const values = t.columns.map((col) => sqlLiteral(row[col]));
        db.run("INSERT INTO " + tableName + " (" + columns.join(", ") + ") VALUES (" + values.join(", ") + ");");
      }
    }
  } catch (error) {
    db.close();
    throw error;
  }
  cachedDb = db;
  cachedSeed = seed;
  return db;
}

async function runQuery(data) {
  const { id, type, tables, sql, rowCap } = data;
  try {
    if (type === "run") {
      const db = await getDb(tables);
      const start = performance.now();
      const results = db.exec(sql);
      const elapsedMs = performance.now() - start;
      if (results.length === 0) {
        self.postMessage({ id, ok: true, columns: [], rows: [], rowCount: 0, truncated: false, elapsedMs });
        return;
      }
      const { columns, values } = results[0];
      const truncated = values.length > rowCap;
      self.postMessage({
        id,
        ok: true,
        columns,
        rows: truncated ? values.slice(0, rowCap) : values,
        rowCount: values.length,
        truncated,
        elapsedMs,
      });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: err && err.message ? err.message : String(err) });
  }
}

self.onmessage = (event) => {
  runQueue = runQueue.then(() => runQuery(event.data));
};
