import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TICKETS } from "../lib/tickets";
import { useShift } from "../lib/ShiftContext";
import SlaCountdown from "../components/SlaCountdown";

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: "badge-red",
  MEDIUM: "badge-amber",
  LOW: "badge-gray",
};

const STATUS_BADGE: Record<string, string> = {
  new: "badge-gray",
  in_progress: "badge-amber",
  resolved: "badge-green",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

type TrackFilter = "all" | string;
type StatusFilter = "all" | "new" | "in_progress" | "resolved";

export default function QueuePage() {
  const { state, startShift, resetShift } = useShift();
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const tracks = useMemo(() => Array.from(new Set(TICKETS.map((t) => t.track))).sort(), []);

  const rows = useMemo(() => {
    return TICKETS.map((t) => {
      const work = state.tickets[t.id];
      const status = work?.status ?? "new";
      return { ticket: t, status };
    }).filter((r) => {
      if (trackFilter !== "all" && r.ticket.track !== trackFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [state.tickets, trackFilter, statusFilter]);

  const resolvedCount = TICKETS.filter((t) => (state.tickets[t.id]?.status ?? "new") === "resolved").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="mb-2 block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            Shift queue
          </span>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink sm:text-[28px]">Today's incidents</h1>
          <p className="mt-2 max-w-[62ch] text-[14px] text-ink-2">
            {state.shiftStartedAt
              ? "Your shift clock is running. SLA countdowns move based on the simulated shift, not your wall clock."
              : "Start your shift to begin the SLA countdown for every ticket in the queue."}
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          {!state.shiftStartedAt ? (
            <button type="button" className="btn btn-primary h-10 px-4" onClick={startShift}>
              Start shift
            </button>
          ) : (
            <span className="tag font-mono">
              {resolvedCount}/{TICKETS.length} resolved
            </span>
          )}
          <button
            type="button"
            className="btn h-10 px-4"
            onClick={() => {
              if (window.confirm("Reset your shift? This clears all progress, scores and SLA timers.")) {
                resetShift();
              }
            }}
          >
            Reset shift
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterPill active={trackFilter === "all"} onClick={() => setTrackFilter("all")}>
          All tracks
        </FilterPill>
        {tracks.map((track) => (
          <FilterPill key={track} active={trackFilter === track} onClick={() => setTrackFilter(track)}>
            {track}
          </FilterPill>
        ))}
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          All statuses
        </FilterPill>
        <FilterPill active={statusFilter === "new"} onClick={() => setStatusFilter("new")}>
          New
        </FilterPill>
        <FilterPill active={statusFilter === "in_progress"} onClick={() => setStatusFilter("in_progress")}>
          In progress
        </FilterPill>
        <FilterPill active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>
          Resolved
        </FilterPill>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface-sunken">
                <Th>Ticket</Th>
                <Th>Track</Th>
                <Th>Priority</Th>
                <Th>Channel</Th>
                <Th>Status</Th>
                <Th align="right">SLA</Th>
                <Th align="right">Open</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ticket, status }) => (
                <tr key={ticket.id} className="border-t border-line hover:bg-surface-sunken/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[11.5px] font-medium text-muted">{ticket.id}</span>
                      <span className="text-[13.5px] font-medium text-ink">{ticket.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="tag">{ticket.track}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${PRIORITY_BADGE[ticket.priority]}`}>{ticket.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted">{ticket.channel}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SlaCountdown ticket={ticket} shiftStartedAt={state.shiftStartedAt} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/ticket/${ticket.id}`} className="btn btn-sm btn-outline" onClick={() => !state.shiftStartedAt && startShift()}>
                      {status === "resolved" ? "Review" : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-muted">
                    No tickets match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
        active ? "border-accent bg-accent-tint text-accent-ink" : "border-line bg-surface text-muted hover:bg-surface-sunken"
      }`}
    >
      {children}
    </button>
  );
}
