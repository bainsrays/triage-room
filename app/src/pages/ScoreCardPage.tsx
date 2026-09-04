import { useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getTicketById } from "../lib/tickets";
import { useShift } from "../lib/ShiftContext";
import RadarChart from "../components/RadarChart";

export default function ScoreCardPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const ticket = ticketId ? getTicketById(ticketId) : undefined;
  const { state } = useShift();
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!ticket) return <Navigate to="/queue" replace />;

  const score = state.scores[ticket.id];
  const work = state.tickets[ticket.id];

  if (!score || !work || work.status !== "resolved") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-[20px] font-semibold text-ink">No score yet for {ticket.id}</h1>
        <p className="mt-2 text-[14px] text-muted">Work through this ticket and submit your reply to see a score card.</p>
        <Link to={`/ticket/${ticket.id}`} className="btn btn-primary mt-5">
          Open ticket
        </Link>
      </div>
    );
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const { toPng } = await import("html-to-image");
      // skipFonts avoids html-to-image trying to read cssRules from the
      // cross-origin Google Fonts stylesheet (throws a SecurityError in some
      // browsers because of CORS) - the exported card falls back to the
      // nearest local sans-serif, which is fine for a wordmark + numbers.
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#ffffff", skipFonts: true });
      const link = document.createElement("a");
      link.download = `${ticket!.id}-triageroom-score.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export the score card.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <Link to="/queue" className="font-medium text-accent hover:text-accent-hover">
          ← Queue
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/ticket/${ticket.id}`} className="font-medium text-accent hover:text-accent-hover">
          {ticket.id}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Score card</span>
      </div>

      {/* Shareable card (this ref is what gets exported to PNG — no PII beyond ticket id + scores) */}
      <div ref={cardRef} className="card overflow-hidden bg-surface">
        <div className="flex items-center gap-3 border-b border-line bg-surface-sunken px-5 py-4">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
              <path d="M9 21.2l2 2 4-4.2" />
            </svg>
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">triageroom</p>
            <p className="font-mono text-[11px] text-muted">
              {ticket.id} · {new Date(work.submittedAt ?? Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-[26px] font-semibold text-accent-ink">{score.totalDisplay}</p>
            <p className="font-mono text-[10.5px] text-muted">out of 100</p>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:grid-cols-[280px_1fr] sm:items-center">
          <RadarChart axes={score.axes} />

          <div className="grid gap-2.5">
            {score.axes.map((axis) => (
              <div key={axis.axisKey} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line py-2 text-[13px] last:border-b-0">
                <span className="font-medium leading-snug text-ink">{axis.axisLabel}</span>
                <span className="w-10 text-right font-mono text-[11px] text-ink">{axis.score}/3</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full border border-line bg-surface-sunken">
                  <span className="block h-full bg-accent" style={{ width: `${(axis.score / 3) * 100}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={exporting}>
          {exporting ? "Preparing…" : "Download card (PNG)"}
        </button>
        <Link to={`/ticket/${ticket.id}`} className="btn">
          Back to ticket
        </Link>
        <Link to="/queue" className="btn">
          Back to queue
        </Link>
      </div>
      {exportError && <p className="mt-2 text-[12.5px] text-danger">{exportError}</p>}

      {/* Detailed reasons (not part of the exported card) */}
      <div className="mt-8 grid gap-3">
        <h2 className="text-[16px] font-semibold text-ink">Why you scored this way</h2>
        {score.axes.map((axis) => (
          <details key={axis.axisKey} className="card overflow-hidden" open>
            <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[13.5px] font-medium text-ink">
              {axis.axisLabel}
              <span className="ml-auto font-mono text-[12px] text-muted">{axis.score}/3</span>
            </summary>
            <ul className="grid gap-1.5 border-t border-line bg-surface-sunken/40 px-4 py-3">
              {axis.reasons.map((r, i) => (
                <li key={i} className="text-[12.5px] leading-relaxed text-ink-2">
                  {r}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {/* Model reply comparison */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Your reply</h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{work.replyDraft || "(empty)"}</p>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Reference reply (model_reply)</h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{ticket.model_reply}</p>
        </div>
      </div>
    </div>
  );
}
