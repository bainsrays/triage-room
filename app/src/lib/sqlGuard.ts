// Guards the SQL Scratchpad: read-only, single-statement, SELECT/WITH only.
// This is deliberately conservative — critics will try `DROP TABLE`,
// `; --` stacked statements, `PRAGMA`, `ATTACH`, `UPDATE`, ad hoc functions
// like `sqlite_version()`, etc. We reject anything that is not unambiguously
// a single read query.

export interface SqlGuardResult {
  allowed: boolean;
  reason?: string;
  normalized?: string;
}

const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "attach",
  "detach",
  "pragma",
  "vacuum",
  "reindex",
  "replace",
  "truncate",
  "grant",
  "revoke",
  "begin",
  "commit",
  "rollback",
  "savepoint",
];

/** Strips SQL comments (-- line and /* block *​/) so keyword checks can't be evaded. */
export function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (sql[i] === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += sql[i];
    i++;
  }
  return out;
}

/** Removes string literals so we don't false-positive on keywords inside quoted strings. */
function stripStringLiterals(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

export function evaluateSqlQuery(rawSql: string): SqlGuardResult {
  const withoutComments = stripSqlComments(rawSql);
  const trimmed = withoutComments.trim();

  if (trimmed.length === 0) {
    return { allowed: false, reason: "Query is empty." };
  }

  // Reject multiple statements: allow at most one trailing semicolon.
  const withoutTrailingSemi = trimmed.replace(/;\s*$/, "");
  const withoutLiterals = stripStringLiterals(withoutTrailingSemi);
  if (withoutLiterals.includes(";")) {
    return { allowed: false, reason: "Only a single statement is allowed (found a `;` inside the query)." };
  }

  const lowerNoLiterals = withoutLiterals.toLowerCase();

  const firstWordMatch = lowerNoLiterals.match(/^\s*([a-z_]+)/i);
  const firstWord = firstWordMatch ? firstWordMatch[1].toLowerCase() : "";
  if (firstWord !== "select" && firstWord !== "with") {
    const WRITE_WORDS = new Set(["insert", "update", "delete", "drop", "alter", "create", "replace", "truncate", "attach", "detach", "pragma", "vacuum", "reindex", "begin", "commit", "rollback"]);
    const looksLikeTypo = firstWord.length >= 3 && !WRITE_WORDS.has(firstWord) && ("select".startsWith(firstWord) || firstWord.startsWith("sel") || firstWord.startsWith("wit"));
    return {
      allowed: false,
      reason: looksLikeTypo
        ? `Syntax error near "${firstWord.toUpperCase()}": did you mean SELECT?`
        : `Only SELECT (or WITH ... SELECT) statements are allowed; "${firstWord.toUpperCase()}" is not. This scratchpad is a read-only replica.`,
    };
  }

  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z_])${kw}([^a-z_]|$)`, "i");
    if (re.test(lowerNoLiterals)) {
      return {
        allowed: false,
        reason: `The keyword "${kw.toUpperCase()}" is not allowed on this read-only replica.`,
      };
    }
  }

  // WITH must eventually contain a SELECT (guards against `WITH x AS (...) INSERT ...` style tricks,
  // though INSERT is already caught above; this is a defense-in-depth structural check).
  if (firstWord === "with" && !/\bselect\b/i.test(lowerNoLiterals)) {
    return { allowed: false, reason: "A WITH clause must be followed by a SELECT." };
  }

  return { allowed: true, normalized: withoutTrailingSemi.trim() };
}

export const SQL_ROW_CAP = 500;
export const SQL_TIMEOUT_MS = 5000;
