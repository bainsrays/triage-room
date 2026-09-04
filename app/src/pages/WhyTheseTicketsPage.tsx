import { Link } from "react-router-dom";
import recruiterBlock from "../content/recruiter-block.md?raw";
import { TICKETS } from "../lib/tickets";

function paragraphsOf(md: string): string[] {
  return md
    .split("\n\n")
    .map((p) => p.replace(/^#.*\n?/gm, "").trim())
    .filter(Boolean);
}

export default function WhyTheseTicketsPage() {
  const paragraphs = paragraphsOf(recruiterBlock);
  const tracks = Array.from(new Set(TICKETS.map((t) => t.track)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <span className="mb-3 block font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        Why these tickets
      </span>
      <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">What this demonstrates</h1>

      <div className="mt-5 grid gap-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-ink-2">
            {p}
          </p>
        ))}
      </div>

      <div className="mt-8 grid gap-3">
        <h2 className="text-[16px] font-semibold text-ink">Tracks covered</h2>
        <div className="flex flex-wrap gap-2">
          {tracks.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-sunken">
              <th className="border-b border-line px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                Ticket
              </th>
              <th className="border-b border-line px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                Track
              </th>
              <th className="border-b border-line px-3 py-2 text-left font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted">
                Mechanism
              </th>
            </tr>
          </thead>
          <tbody>
            {TICKETS.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-b-0">
                <td className="px-3 py-2 font-mono text-[12px] text-ink">{t.id}</td>
                <td className="px-3 py-2 text-ink-2">{t.track}</td>
                <td className="px-3 py-2 text-ink-2">{t.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <Link to="/queue" className="btn btn-primary">
          Start a shift
        </Link>
      </div>
    </div>
  );
}
