// Simulated shift clock.
//
// Design decision (not specified by content — documented here and in the final
// report as an assumption): ticket timestamps in content/tickets/*.json span
// several different calendar days (Aug 26–31 2026), because they were authored
// as independent narrative snapshots, not as one consistent shift. Rather than
// diffing across days (which would make some tickets look days-overdue and
// others untouched), we derive each ticket's "time remaining at shift start"
// from its own SLA window and priority — a HIGH priority ticket has already
// eaten most of its SLA budget by the time it reaches the queue (urgency),
// while a LOW priority ticket still has most of its window left. The shift
// clock then ticks this down live, accelerated, once the user clicks
// "Start shift", so the countdown genuinely moves during the session instead
// of being frozen or tied to the real wall clock.
import type { Ticket } from "../types/ticket";

export const SIM_ACCELERATION = 90; // 1 real second = 90 simulated seconds (~1.5 sim min/sec)

const PRIORITY_CONSUMED_FRACTION: Record<Ticket["priority"], number> = {
  HIGH: 0.92,
  MEDIUM: 0.6,
  LOW: 0.3,
};

/** Time (ms) already "used up" against a ticket's SLA when the shift starts. */
export function initialConsumedMs(ticket: Ticket): number {
  const totalMs = ticket.sla_minutes * 60_000;
  return totalMs * PRIORITY_CONSUMED_FRACTION[ticket.priority];
}

/** Time (ms) remaining on a ticket's SLA at a given point in the shift. */
export function remainingMsAt(ticket: Ticket, shiftStartedAt: number, nowMs: number): number {
  const totalMs = ticket.sla_minutes * 60_000;
  const consumedAtStart = initialConsumedMs(ticket);
  const elapsedSim = Math.max(0, nowMs - shiftStartedAt) * SIM_ACCELERATION;
  return totalMs - consumedAtStart - elapsedSim;
}

export type SlaBand = "breached" | "critical" | "warning" | "safe";

export function slaBand(remainingMs: number, totalMs: number): SlaBand {
  if (remainingMs <= 0) return "breached";
  const ratio = remainingMs / totalMs;
  if (ratio < 0.15) return "critical";
  if (ratio < 0.4) return "warning";
  return "safe";
}

export function formatCountdown(remainingMs: number): string {
  return formatCountdownImpl(remainingMs);
}

/** Ticket timestamps are authored in WAT (+01:00). Render them as the agent on shift would see them. */
export function formatTicketTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${fmt.format(d)} WAT`;
}

function formatCountdownImpl(remainingMs: number): string {
  const neg = remainingMs < 0;
  const abs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(abs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const body = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return neg ? `-${body}` : body;
}
