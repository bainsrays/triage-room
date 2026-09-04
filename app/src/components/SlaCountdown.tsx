import { useEffect, useState } from "react";
import type { Ticket } from "../types/ticket";
import { formatCountdown, remainingMsAt, slaBand } from "../lib/shiftClock";

const BAND_CLASSES: Record<string, string> = {
  breached: "badge-red",
  critical: "badge-red",
  warning: "badge-amber",
  safe: "badge-green",
};

export default function SlaCountdown({ ticket, shiftStartedAt }: { ticket: Ticket; shiftStartedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!shiftStartedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [shiftStartedAt]);

  if (!shiftStartedAt) {
    return <span className="tag font-mono">SLA {ticket.sla_minutes}m</span>;
  }

  const totalMs = ticket.sla_minutes * 60_000;
  const remaining = remainingMsAt(ticket, shiftStartedAt, now);
  const band = slaBand(remaining, totalMs);

  return (
    <span className={`badge ${BAND_CLASSES[band]} font-mono`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {band === "breached" ? "SLA breached " : "SLA "}
      {formatCountdown(remaining)}
    </span>
  );
}
