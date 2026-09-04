import { useMemo } from "react";
import type { Ticket } from "../types/ticket";
import { runComposerChecks } from "../scoring/composerChecks";

const SEVERITY_ICON: Record<string, string> = {
  danger: "text-danger",
  warning: "text-warn",
  info: "text-muted",
};

export default function ReplyComposer({
  ticket,
  value,
  onChange,
  disabled,
  revealed = false,
}: {
  ticket: Ticket;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  revealed?: boolean;
}) {
  const checks = useMemo(() => runComposerChecks(value, ticket, { revealed }), [value, ticket, revealed]);
  const wordCount = value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="grid gap-2">
        <label htmlFor="reply-editor" className="text-[13px] font-medium text-ink">
          Your reply to {ticket.customer.name.split(" ")[0]}
        </label>
        <textarea
          id="reply-editor"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full rounded-lg border border-line bg-surface p-3 text-[13.5px] leading-relaxed text-ink outline-none focus:border-accent disabled:bg-surface-sunken disabled:text-muted"
          placeholder="Write your reply to the customer here..."
        />
        <p className="text-[11.5px] text-muted">{wordCount} words · {value.length} characters</p>
      </div>

      <aside className="card grid content-start gap-0 overflow-hidden">
        <div className="border-b border-line bg-surface-sunken px-3 py-2">
          <h3 className="text-[12.5px] font-semibold text-ink">Live composer checks</h3>
        </div>
        <ul className="grid gap-0">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 border-b border-line px-3 py-2 text-[12px] last:border-b-0">
              <span className={`mt-0.5 flex-none ${c.passed ? "text-success" : SEVERITY_ICON[c.severity]}`} aria-hidden="true">
                {c.passed ? (
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10 6v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
                  </svg>
                )}
              </span>
              <div>
                <p className={`font-medium ${c.passed ? "text-ink" : "text-ink"}`}>{c.label}</p>
                <p className="mt-0.5 text-muted">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
