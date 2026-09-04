import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/queue", label: "Queue" },
  { to: "/how-scoring-works", label: "How scoring works" },
  { to: "/why-these-tickets", label: "Why these tickets" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line-strong/60 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="mr-auto flex items-center gap-2.5 text-[16px] font-semibold tracking-tight text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-white shadow-sm" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
              <path d="M4 13h2.4a1 1 0 0 1 1 1v3.6a1 1 0 0 1-1 1H5.6A1.6 1.6 0 0 1 4 17V13Z" />
              <path d="M20 13h-2.4a1 1 0 0 0-1 1v3.6a1 1 0 0 0 1 1h.8A1.6 1.6 0 0 0 20 17V13Z" />
              <path d="M9 21.2l2 2 4-4.2" />
            </svg>
          </span>
          Triage Room
          <span className="hidden border-l border-line pl-2.5 font-mono text-[10.5px] font-medium text-muted sm:inline">
            support simulator
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `inline-flex h-9 items-center rounded-md px-3 text-[13.5px] font-medium ${
                  isActive ? "bg-accent-tint text-accent-ink" : "text-muted hover:bg-surface-sunken hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link to="/queue" className="btn btn-primary hidden md:inline-flex">
          Start a shift
        </Link>

        <button
          type="button"
          className="btn btn-ghost md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary mobile" className="border-t border-line bg-surface px-4 py-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex h-11 items-center rounded-md px-3 text-[14px] font-medium ${
                      isActive ? "bg-accent-tint text-accent-ink" : "text-ink-2"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <Link to="/queue" onClick={() => setOpen(false)} className="btn btn-primary mt-1 w-full">
                Start a shift
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
