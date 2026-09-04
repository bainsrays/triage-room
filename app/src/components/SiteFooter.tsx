export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-muted">
            Triage Room is a free personal training project built by <strong className="font-semibold text-ink">Sodiq</strong>,
            a support and technical-support engineer. It is not a company product, and it is not affiliated
            with any bank, processor or exchange. All customers, references and balances are simulated.
          </p>
          <nav aria-label="Footer" className="flex flex-none flex-wrap gap-4 text-[13px]">
            <a href="/queue" className="font-medium text-muted hover:text-ink">
              The tickets
            </a>
            <a href="/how-scoring-works" className="font-medium text-muted hover:text-ink">
              Rubric
            </a>
            <a href="/why-these-tickets" className="font-medium text-muted hover:text-ink">
              Why these tickets
            </a>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-5 text-[13px] text-muted">
          <span>
            Built by <strong className="font-semibold text-ink">Sodiq</strong>
          </span>
          <a href="https://www.linkedin.com/in/sodiq-egberongbe-b3239166" target="_blank" rel="noreferrer" className="font-medium hover:text-ink">
            LinkedIn
          </a>
          <a href="https://github.com/bainsrays/triage-room" target="_blank" rel="noreferrer" className="font-medium hover:text-ink">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
