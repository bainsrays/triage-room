import { useState } from "react";
import type { Ticket } from "../types/ticket";
import { evaluateSqlQuery } from "../lib/sqlGuard";
import { extractSeedTables, quoteSqlIdentifier, runSqlQuery } from "../lib/sqlDb";
import { useShift } from "../lib/ShiftContext";

export default function SqlScratchpad({ ticket, revealed = false }: { ticket: Ticket; revealed?: boolean }) {
  const { recordSqlQuery } = useShift();
  const { tables, suggestedQueries } = extractSeedTables(ticket);
  const defaultQuery = tables[0] ? `SELECT * FROM ${quoteSqlIdentifier(tables[0].name)} LIMIT 10;` : "SELECT 1;";
  const [query, setQuery] = useState(defaultQuery);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean; elapsedMs: number } | null>(
    null
  );

  async function handleRun() {
    setError(null);
    setResult(null);

    const guard = evaluateSqlQuery(query);
    if (!guard.allowed) {
      setError(guard.reason ?? "Query rejected.");
      recordSqlQuery(ticket.id, { query, ranAt: Date.now(), allowed: false, errorMessage: guard.reason });
      return;
    }

    setRunning(true);
    try {
      const outcome = await runSqlQuery(tables, guard.normalized!);
      if (outcome.ok) {
        setResult(outcome.result);
        recordSqlQuery(ticket.id, { query, ranAt: Date.now(), allowed: true, rowCount: outcome.result.rowCount });
      } else {
        setError(outcome.error);
        recordSqlQuery(ticket.id, { query, ranAt: Date.now(), allowed: true, errorMessage: outcome.error });
      }
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface-sunken/50 p-4 text-[13px] text-muted">
        This ticket has no queryable tables — its evidence lives entirely in the tool panels above.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border border-ink bg-[#0B1615]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-white/70">
          <span>triage_sim · read-only replica</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[10.5px] text-[#8FB8AF]">{tables.length} table{tables.length === 1 ? "" : "s"}</span>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {running ? "Running…" : "Run ⌘↵"}
            </button>
          </span>
        </div>
        <label htmlFor="sql-scratchpad-input" className="sr-only">
          SQL query
        </label>
        <textarea
          id="sql-scratchpad-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          rows={5}
          className="w-full resize-y bg-transparent px-3 py-3 font-mono text-[12.5px] leading-relaxed text-[#E7F4F1] outline-none placeholder:text-white/30"
          placeholder="SELECT * FROM transactions WHERE ..."
        />
        <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 py-2">
          {tables.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setQuery(`SELECT * FROM ${quoteSqlIdentifier(t.name)} LIMIT 10;`)}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/80 hover:bg-white/10"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-tint px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {/* Suggested queries carry the investigation conclusion in their result_summary, so they are
          only revealed AFTER the ticket is submitted. Before that, Tool Efficiency scores whether
          the candidate found the right query on their own. */}
      {revealed && suggestedQueries.length > 0 && (
        <div className="grid gap-1.5" data-testid="sql-suggested-queries">
          <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">What a senior investigator would have run</h4>
          {suggestedQueries.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setQuery(sq.query)}
              className="rounded-md border border-line bg-surface-sunken/50 px-3 py-2 text-left text-[11.5px] hover:border-accent hover:bg-accent-tint/30"
            >
              <code className="block font-mono text-[11px] text-accent-ink">{sq.query}</code>
              <span className="mt-1 block text-muted">{sq.result_summary}</span>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="grid gap-2">
          <p className="text-[11.5px] text-muted">
            <span className="badge badge-gray">
              {result.rowCount} row{result.rowCount === 1 ? "" : "s"} · {result.elapsedMs.toFixed(0)} ms
            </span>
            {result.truncated && <span className="ml-2">Capped at 500 rows.</span>}
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[400px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-surface-sunken">
                  {result.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-b-0">
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2 font-mono text-ink">
                        {cell === null || cell === undefined ? "—" : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
