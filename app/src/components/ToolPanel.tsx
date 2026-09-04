// Renders a single tool's data generically, driven entirely by the shape of
// that tool's JSON in ticket.tools[toolKey]. No per-ticket hardcoding.
import type { ReactNode } from "react";
import { formatTicketTime } from "../lib/shiftClock";

interface TableShape {
  columns: string[];
  rows: Record<string, unknown>[];
  status_history?: { timestamp: string; status: string; note: string }[];
}

function isTableShape(v: unknown): v is TableShape {
  return !!v && typeof v === "object" && Array.isArray((v as TableShape).columns) && Array.isArray((v as TableShape).rows);
}

function isKbArray(v: unknown): v is { title: string; body: string }[] {
  return Array.isArray(v) && v.every((item) => item && typeof item === "object" && "title" in item && "body" in item);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("en-US");
  return String(value);
}

function KeyValueGrid({ obj }: { obj: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {Object.entries(obj).map(([key, value]) => (
        <div key={key} className="grid gap-0.5">
          <dt className="font-mono text-[10.5px] uppercase tracking-wide text-muted">{key.replace(/_/g, " ")}</dt>
          <dd className="break-words text-[13px] text-ink [overflow-wrap:anywhere]">
            {value === null || value === undefined ? (
              "—"
            ) : typeof value === "object" ? (
              <NestedValue value={value} />
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function NestedValue({ value }: { value: unknown }): ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="grid gap-1">
        {value.map((item, i) => (
          <li key={i} className="text-[12.5px] text-ink-2 [overflow-wrap:anywhere]">
            {typeof item === "object" && item !== null ? <NestedObjectLine obj={item as Record<string, unknown>} /> : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return <KeyValueGrid obj={value as Record<string, unknown>} />;
  }
  return <>{String(value)}</>;
}

function NestedObjectLine({ obj }: { obj: Record<string, unknown> }) {
  return (
    <span className="font-mono text-[12px]">
      {Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")}
    </span>
  );
}

function DataTable({ table }: { table: TableShape }) {
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[480px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-surface-sunken">
              {table.columns.map((col) => (
                <th key={col} className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length} className="px-3 py-4 text-center text-[12px] text-muted">
                  No rows returned.
                </td>
              </tr>
            ) : (
              table.rows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-b-0">
                  {table.columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-3 py-2 font-mono text-ink">
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.status_history && table.status_history.length > 0 && (
        <div className="rounded-lg border border-line bg-surface-sunken/50 p-3">
          <h4 className="mb-2 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">Status history</h4>
          <ol className="grid gap-1.5">
            {table.status_history.map((h, i) => (
              <li key={i} className="grid grid-cols-1 items-baseline gap-x-2 gap-y-0.5 text-[12px] sm:grid-cols-[auto_auto_1fr]">
                <time className="font-mono text-muted sm:whitespace-nowrap" dateTime={h.timestamp}>{formatTicketTime(h.timestamp)}</time>
                <span className="font-mono font-medium text-accent-ink [overflow-wrap:anywhere] sm:whitespace-nowrap">{h.status}</span>
                <span className="text-ink-2 [overflow-wrap:anywhere]">{h.note}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function KbList({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item, i) => (
        <div key={i} className="kb-item">
          <h4 className="text-[13px] font-semibold text-ink">{item.title}</h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function ToolPanel({ toolKey, data }: { toolKey: string; data: unknown }) {
  if (isKbArray(data)) return <KbList items={data} />;
  if (isTableShape(data)) return <DataTable table={data} />;
  if (Array.isArray(data)) {
    return (
      <ul className="grid gap-1.5">
        {data.map((item, i) => (
          <li key={i} className="rounded-md border border-line bg-surface-sunken/50 px-3 py-2 text-[12.5px] text-ink-2">
            {typeof item === "object" && item !== null ? <NestedObjectLine obj={item as Record<string, unknown>} /> : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (data && typeof data === "object") {
    // Objects that themselves contain one nested table-shaped or kb-shaped value
    // (e.g. { incidents: [...] }) get flattened one level for readability.
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div className="grid gap-4">
        {entries.map(([key, value]) => (
          <div key={key} className="grid gap-2">
            <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">{key.replace(/_/g, " ")}</h4>
            {isTableShape(value) ? (
              <DataTable table={value} />
            ) : isKbArray(value) ? (
              <KbList items={value} />
            ) : Array.isArray(value) ? (
              <ul className="grid gap-1.5">
                {value.map((item, i) => (
                  <li key={i} className="rounded-md border border-line bg-surface-sunken/50 px-3 py-2 text-[12.5px] text-ink-2">
                    {typeof item === "object" && item !== null ? <NestedObjectLine obj={item as Record<string, unknown>} /> : String(item)}
                  </li>
                ))}
              </ul>
            ) : value && typeof value === "object" ? (
              <KeyValueGrid obj={value as Record<string, unknown>} />
            ) : (
              <p className="text-[13px] text-ink">{String(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-[13px] text-muted">No data for {toolKey}.</p>;
}
