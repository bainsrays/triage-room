import { Link } from "react-router-dom";
import { TICKETS } from "../lib/tickets";
import { evidenceToolKeys } from "../scoring/engine";

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: "badge-red",
  MEDIUM: "badge-amber",
  LOW: "badge-gray",
};

export default function LandingPage() {
  const previewTickets = TICKETS.slice(0, 4);
  const trackCount = new Set(TICKETS.map((t) => t.track)).size;

  return (
    <div>
      {/* HERO */}
      <section className="border-b border-line-strong/60 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-[20ch] text-[34px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[44px] lg:text-[52px]">
              Practice the fintech support shift they'll actually test you on.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink-2 sm:text-[18px]">
              Eleven incidents across <strong className="font-medium text-ink">payments</strong>,{" "}
              <strong className="font-medium text-ink">wallets</strong>,{" "}
              <strong className="font-medium text-ink">crypto remittance</strong>,{" "}
              <strong className="font-medium text-ink">KYC</strong> and{" "}
              <strong className="font-medium text-ink">merchant API debugging</strong>. Investigate with
              real transaction logs, a webhook inspector and a SQL scratchpad.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/queue" className="btn btn-primary h-11 px-5 text-[15px]">
                Start a shift
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link to="/how-scoring-works" className="btn h-11 px-5 text-[15px]">
                See how scoring works
              </Link>
            </div>
          </div>

          {/* Workspace preview card */}
          <div
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-card"
            role="img"
            aria-label="Preview of the Triage Room ticket workspace showing incident INC-2101, a stuck NGN 250,000 NIP transfer, with a transaction log row returning TIMEOUT."
          >
            <div className="flex items-center gap-3 border-b border-line bg-surface-sunken px-4 py-2.5">
              <span className="truncate font-mono text-[11px] text-muted">workspace / queue / INC-2101</span>
              <span className="ml-auto whitespace-nowrap rounded-full border border-warn-line bg-warn-tint px-2.5 py-0.5 font-mono text-[11px] font-medium text-warn">
                SLA 00:47:12 left
              </span>
            </div>
            <div className="grid gap-4 p-4">
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                  <span className="font-medium text-ink">INC-2101</span>
                  <span className="badge badge-red">High</span>
                  <span className="tag">Payments</span>
                  <span className="badge badge-amber">Pending</span>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-ink">Transfer stuck on "Pending" for 6 hours</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>
                    Customer <b className="font-mono font-medium text-ink">Ifeoma Chukwu</b>
                  </span>
                  <span>
                    Amount <b className="font-mono font-medium text-ink">NGN 250,000.00</b>
                  </span>
                  <span>
                    Rail <b className="font-mono font-medium text-ink">NIP</b>
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface-sunken px-3 py-2 text-[12px] font-medium text-ink">
                  Transaction log
                  <span className="tag ml-auto font-mono">1 attempt</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-[11.5px]">
                    <thead>
                      <tr>
                        <th className="border-b border-line px-3 py-1.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                          Reference
                        </th>
                        <th className="border-b border-line px-3 py-1.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                          Time
                        </th>
                        <th className="border-b border-line px-3 py-1.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                          Resp
                        </th>
                        <th className="border-b border-line px-3 py-1.5 text-right font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-accent-tint/50">
                        <td className="px-3 py-2 font-mono text-ink">TRX-9F31A2</td>
                        <td className="px-3 py-2 font-mono text-ink">08:41:12</td>
                        <td className="px-3 py-2 font-mono font-medium text-warn">TIMEOUT</td>
                        <td className="px-3 py-2 text-right font-mono text-ink">250,000.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="flex items-center gap-2 rounded-lg border border-dashed border-accent-line bg-accent-tint px-3 py-2.5 text-[12px] text-ink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Evidence pinned to your root-cause answer
                <span className="ml-auto whitespace-nowrap font-mono text-muted">1 of 2 tools</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-line-strong/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 max-w-[62ch]">
            <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              How it works
            </span>
            <h2 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
              Four things a hiring manager can verify in one click.
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
              Every shift runs the same loop: read the ticket, investigate with the real tool set, commit
              a root cause, write the customer reply, get scored against a published rubric.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            <ProofCard
              title="Real incident mechanics, not trivia"
              body="Tickets turn on how the rail actually behaves: NIP timeouts and requery windows, webhook retries, wrong-network token deposits, quote-lock expiry."
              detail="INC-2102 hinges on a POS retry after a terminal timeout leading to two separate captures, not 'a payment failed'."
            />
            <ProofCard
              title="The same tool set you'd open at work"
              body="Customer 360, transaction log, auth and risk events, KYC console, merchant API console with a webhook log, partner status, crypto deposit monitor, rates and quotes."
              detail="SQL scratchpad queries the ticket's own seeded tables directly, read-only."
            />
            <ProofCard
              title="Every attempt produces a shareable score"
              body="Five competency dimensions, each with the rubric line that earned or cost the points. Download the card, and the reasoning travels with the number."
              detail="Debrief shows your reply next to the reference model_reply for that ticket."
            />
            <ProofCard
              title="Scoped to what these roles actually list"
              body="Nigerian and cross-border rails at the centre: NIP transfers, BVN name matching, USD virtual accounts, USDT-to-NGN off-ramps, merchant API keys and webhooks."
              detail="Compliance-safe by design: no full card numbers, no full BVNs, no over-promising."
            />
          </div>
        </div>
      </section>

      {/* TICKETS PREVIEW */}
      <section className="border-b border-line-strong/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 flex flex-wrap items-end gap-4">
            <div className="max-w-[62ch]">
              <h2 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Today's queue.</h2>
              <p className="mt-2 text-[16px] text-ink-2">
                Four of the eleven incidents in rotation. Priority and track are assigned the way a real
                support queue assigns them.
              </p>
            </div>
            <p className="ml-auto whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-muted">
              {TICKETS.length} incidents · {trackCount} tracks
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewTickets.map((t) => (
              <div key={t.id} className="card grid gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-medium text-ink">{t.id}</span>
                  <span className={`badge ${PRIORITY_BADGE[t.priority]} ml-auto`}>{t.priority}</span>
                </div>
                <h3 className="text-[14px] font-semibold leading-snug text-ink">{t.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted">{t.red_herring.split(";")[0]}.</p>
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 font-mono text-[11px] text-muted">
                  <span className="tag">{t.track}</span>
                  <span className="ml-auto whitespace-nowrap">{evidenceToolKeys(t).length + 1} tools</span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-2 text-[14px] text-muted">
            Also in rotation: account lockouts, chargeback disputes, merchant API key rotations, a wire
            stuck in a partner bank's suspense queue, and a quote that expired mid-withdrawal.
            <Link to="/queue" className="font-medium text-accent hover:text-accent-hover">
              Open the full queue →
            </Link>
          </p>
        </div>
      </section>

      {/* SCORING TEASER */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[420px_1fr] lg:items-center">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-surface-sunken px-4 py-3">
                <h3 className="text-[14px] font-semibold text-ink">Shift debrief</h3>
                <span className="ml-auto font-mono text-[11px] text-muted">example · not your data</span>
              </div>
              <div className="grid gap-1 p-4">
                {[
                  ["Root-Cause Accuracy", 92],
                  ["Tool Efficiency", 78],
                  ["Compliance Safety", 95],
                  ["Communication Clarity", 84],
                  ["Escalation Judgment", 71],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-b-0">
                    <span className="font-medium text-ink">{label}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full border border-line bg-surface-sunken">
                        <span className="block h-full bg-accent" style={{ width: `${val}%` }} />
                      </span>
                      <span className="w-12 text-right font-mono text-[11px] text-ink">{val}/100</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">
                The score shows its working.
              </h2>
              <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-2 sm:text-[18px]">
                Five dimensions, one rubric line per point. Nothing is inferred from a multiple-choice
                answer, and nothing is hidden behind a single number a recruiter cannot check.
              </p>
              <Link to="/how-scoring-works" className="btn btn-outline mt-6 h-10 px-4">
                Read the full rubric
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProofCard({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <article className="grid gap-2 bg-surface p-6">
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="max-w-[46ch] text-[14px] leading-relaxed text-muted">{body}</p>
      <p className="mt-2 border-t border-line pt-2 font-mono text-[11.5px] leading-relaxed text-muted">{detail}</p>
    </article>
  );
}
