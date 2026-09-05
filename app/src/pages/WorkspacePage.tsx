import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getTicketById } from "../lib/tickets";
import { useShift } from "../lib/ShiftContext";
import SlaCountdown from "../components/SlaCountdown";
import ToolTabs from "../components/ToolTabs";
import ChoicePicker from "../components/ChoicePicker";
import EscalationPanel from "../components/EscalationPanel";
import ReplyComposer from "../components/ReplyComposer";
import SqlScratchpad from "../components/SqlScratchpad";
import { runComposerChecks } from "../scoring/composerChecks";
import { formatTicketTime } from "../lib/shiftClock";

export function KnowledgeBaseArticle({ item, onOpen }: {
  item: { title: string; body: string };
  onOpen: () => void;
}) {
  return (
    <details
      className="kb-item w-full text-left"
      onToggle={(event) => {
        if (event.currentTarget.open) onOpen();
      }}
    >
      <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">{item.title}</summary>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
    </details>
  );
}

export default function WorkspacePage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const ticket = ticketId ? getTicketById(ticketId) : undefined;
  const {
    state,
    startShift,
    getTicketWork,
    markToolOpened,
    markKbOpened,
    setRootCause,
    setResolution,
    setEscalation,
    setReplyDraft,
    submitTicket,
  } = useShift();

  const [showScratchpad, setShowScratchpad] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!state.shiftStartedAt) startShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ticket) {
    return <Navigate to="/queue" replace />;
  }

  const currentWork = getTicketWork(ticket.id);
  const isResolved = currentWork.status === "resolved";
  const revealed = isResolved;

  function handleOpenTool(key: string) {
    if (key === "knowledge_base") {
      markKbOpened(ticket!.id);
    } else {
      markToolOpened(ticket!.id, key);
    }
  }

  const checks = runComposerChecks(currentWork.replyDraft, ticket, { revealed });
  const dangerFailing = checks.filter((c) => !c.passed && c.severity === "danger");

  const canSubmit =
    currentWork.selectedRootCauseIndex !== null &&
    currentWork.selectedResolutionIndex !== null &&
    currentWork.escalation !== null &&
    currentWork.replyDraft.trim().length > 0;

  function handleSubmit() {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    submitTicket(ticket!);
    navigate(`/ticket/${ticket!.id}/score`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <Link to="/queue" className="font-medium text-accent hover:text-accent-hover">
          ← Queue
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono">{ticket.id}</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-muted">
            <span className="font-medium text-ink">{ticket.id}</span>
            <span className={`badge ${ticket.priority === "HIGH" ? "badge-red" : ticket.priority === "MEDIUM" ? "badge-amber" : "badge-gray"}`}>
              {ticket.priority}
            </span>
            <span className="tag">{ticket.track}</span>
            <span className="tag">{ticket.channel}</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-[26px]">{ticket.title}</h1>
        </div>
        <SlaCountdown ticket={ticket} shiftStartedAt={state.shiftStartedAt} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
          {/* Customer thread */}
          <section className="card p-4" aria-labelledby="thread-heading">
            <h2 id="thread-heading" className="mb-3 text-[14px] font-semibold text-ink">
              Customer thread
            </h2>
            <div className="grid gap-3">
              {ticket.messages.map((m, i) => (
                <div key={i} className="rounded-lg border border-line bg-surface-sunken/50 p-3">
                  <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted">
                    <span className="font-medium text-ink">{ticket.customer.name}</span>
                    <time className="font-mono" dateTime={m.timestamp}>{formatTicketTime(m.timestamp)}</time>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{m.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Customer panel */}
          <section className="card p-4" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="mb-3 text-[14px] font-semibold text-ink">
              Customer
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-4 [&>div]:min-w-0 [&_dd]:[overflow-wrap:anywhere]">
              <div>
                <dt className="font-mono text-[10.5px] uppercase text-muted">Name</dt>
                <dd className="text-ink">{ticket.customer.name}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] uppercase text-muted">KYC tier</dt>
                <dd className="text-ink">{ticket.customer.kyc_tier}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] uppercase text-muted">Country</dt>
                <dd className="text-ink">{ticket.customer.country}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10.5px] uppercase text-muted">Rails</dt>
                <dd className="text-ink">{ticket.customer.rails.join(", ")}</dd>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <dt className="font-mono text-[10.5px] uppercase text-muted">Account summary</dt>
                <dd className="text-ink-2">{ticket.customer.account_summary}</dd>
              </div>
            </dl>
          </section>

          {/* Tool panels */}
          <section aria-labelledby="tools-heading">
            <h2 id="tools-heading" className="mb-3 text-[14px] font-semibold text-ink">
              Investigation tools
            </h2>
            <ToolTabs
              key={`${ticket.id}-${state.resetId ?? "initial"}`}
              tools={Object.fromEntries(Object.entries(ticket.tools).filter(([k]) => k !== "sql_scratchpad" && k !== "knowledge_base"))}
              onOpenTool={handleOpenTool}
            />
          </section>

          {/* SQL Scratchpad (lazy) */}
          <section aria-labelledby="sql-heading">
            <div className="mb-3 flex items-center gap-2">
              <h2 id="sql-heading" className="text-[14px] font-semibold text-ink">
                SQL Scratchpad
              </h2>
              {!showScratchpad && (
                <button type="button" className="btn btn-sm btn-outline ml-auto" onClick={() => setShowScratchpad(true)}>
                  Open scratchpad
                </button>
              )}
            </div>
            {!showScratchpad && (
              <p className="mb-3 text-[12.5px] text-muted">
                Read-only replica of this ticket's data. Confirming your evidence with a query here counts toward Tool
                Efficiency, the same way a senior investigator would check the ledger rather than trust the panel.
              </p>
            )}
            {showScratchpad && <SqlScratchpad key={`${ticket.id}-${state.resetId ?? "initial"}`} ticket={ticket} revealed={revealed} />}
          </section>

          {/* Root cause */}
          <section className="card p-4" aria-labelledby="rootcause-heading">
            <h2 id="rootcause-heading" className="mb-3 text-[14px] font-semibold text-ink">
              What's the root cause?
            </h2>
            <ChoicePicker
              legend="Select the root cause"
              name="root-cause"
              options={ticket.root_cause_options}
              selectedIndex={currentWork.selectedRootCauseIndex}
              onSelect={(i) => setRootCause(ticket.id, i)}
              disabled={isResolved}
              revealed={revealed}
            />
          </section>

          {/* Resolution */}
          <section className="card p-4" aria-labelledby="resolution-heading">
            <h2 id="resolution-heading" className="mb-3 text-[14px] font-semibold text-ink">
              What's the resolution?
            </h2>
            <ChoicePicker
              legend="Select the resolution"
              name="resolution"
              options={ticket.resolution_options}
              selectedIndex={currentWork.selectedResolutionIndex}
              onSelect={(i) => setResolution(ticket.id, i)}
              disabled={isResolved}
              revealed={revealed}
            />
          </section>

          {/* Escalation */}
          <section className="card p-4" aria-labelledby="escalation-heading">
            <h2 id="escalation-heading" className="mb-3 text-[14px] font-semibold text-ink">
              Escalation
            </h2>
            <EscalationPanel value={currentWork.escalation} onChange={(v) => setEscalation(ticket.id, v)} disabled={isResolved} />
          </section>

          {/* Reply composer */}
          <section className="card p-4" aria-labelledby="reply-heading">
            <h2 id="reply-heading" className="mb-3 text-[14px] font-semibold text-ink">
              Reply to customer
            </h2>
            <ReplyComposer
              ticket={ticket}
              value={currentWork.replyDraft}
              onChange={(v) => setReplyDraft(ticket.id, v)}
              disabled={isResolved}
              revealed={revealed}
            />
          </section>

          {!isResolved && (
            <div className="sticky bottom-4 flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-card">
              {submitAttempted && !canSubmit && (
                <p role="alert" className="text-[12.5px] text-danger">
                  Select a root cause, a resolution, make an escalation decision, and write a reply before submitting.
                </p>
              )}
              {dangerFailing.length > 0 && (
                <p role="alert" className="text-[12.5px] text-warn">
                  Heads up: your reply currently fails {dangerFailing.length} compliance check(s). You can still
                  submit, but it will affect your score.
                </p>
              )}
              <button type="button" className="btn btn-primary h-11 self-end px-6" onClick={handleSubmit}>
                Submit ticket
              </button>
            </div>
          )}

          {isResolved && (
            <div className="flex justify-end">
              <Link to={`/ticket/${ticket.id}/score`} className="btn btn-primary h-11 px-6">
                View score card
              </Link>
            </div>
          )}
        </div>

        {/* Right rail: KB + escalation guidance */}
        <aside className="grid content-start gap-4">
          <section className="card p-4" aria-labelledby="kb-heading">
            <h2 id="kb-heading" className="mb-3 text-[13px] font-semibold text-ink">
              Knowledge base
            </h2>
            {Array.isArray(ticket.tools.knowledge_base) ? (
              <div className="grid gap-2">
                <p className="text-[11.5px] text-muted">Open an article to read it and record KB credit.</p>
                {(ticket.tools.knowledge_base as { title: string; body: string }[]).map((item, i) => (
                  <KnowledgeBaseArticle
                    key={`${ticket.id}-${state.resetId ?? "initial"}-${i}`}
                    item={item}
                    onOpen={() => markKbOpened(ticket.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted">No KB articles for this ticket.</p>
            )}
          </section>

          <section className="card esc p-4" aria-labelledby="esc-guidance-heading">
            <h2 id="esc-guidance-heading" className="mb-2 text-[13px] font-semibold text-ink">
              Escalation judgment
            </h2>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              This is scored on whether you route to the right team with the right ask, not on how fast you escalate. Escalating a ticket that did not need it costs points too.{revealed && (<> Expected customer timeframe: <b className="text-ink">{ticket.customer_expectation_timeframe}</b>.</>)}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
