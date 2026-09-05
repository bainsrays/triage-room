# Triage Room

**Live:** https://triage-room.vercel.app

A fintech support triage simulator. Eleven realistic tickets across payments, merchant API/webhooks, KYC, chargebacks, wires, and crypto/fiat remittance, set on Nigerian and cross-border rails (NIP, USSD, USD virtual accounts, USDT to NGN). You work each ticket the way a support investigator would: open the transaction log, query the read-only SQL replica, read the KB article, pick the root cause and resolution, decide whether to escalate and with what attached, and write the customer reply. Then you get scored on five axes with a written reason for every point lost.

Built by Sodiq as a portfolio piece. No backend, no accounts, no data collection.

## What is in this repo

| Path | What it is |
| --- | --- |
| `content/tickets/21xx.json` | The eleven tickets. Single source of truth: customer thread, tool data, seeded SQL table, red herring, root-cause and resolution options, escalation ground truth, reference reply, rubric anchors per axis. |
| `content/tickets.json` | Merged output of the per-ticket files (`content/merge_tickets.py`). |
| `content/rubric.md` | The public scoring rubric, tone rules, and known limitations. Rendered as-is on `/how-scoring-works`. |
| `content/REDTEAM-REVIEW.md` | Domain review of every ticket before launch: what was wrong (KYC tier, NIP settlement clock, wire identifiers, chain decimals, FX arithmetic) and how it was fixed. Also the answers to the ten most likely expert objections. |
| `app/` | Vite + React 18 + TypeScript + Tailwind. sql.js (SQLite compiled to WASM) runs in a Web Worker with a hard 5 s kill. Scoring is a pure, deterministic TypeScript module. |
| `app/scripts/hostile.mjs` | Playwright hostile pass: empty submits, 16 abusive SQL inputs (`DROP`, `PRAGMA`, `ATTACH`, comment injection, infinite recursion), over-escalation, determinism, reload persistence, 390 px overflow, keyboard-only, unknown routes, console errors. |

## Scoring in one paragraph

Five axes, 0 to 3 each, 15 points scaled to 100. **Root-Cause Accuracy** and **Compliance Safety** compare your root-cause and resolution choices with the ticket's ground truth and scan the reply for unsafe promises. **Tool Efficiency** checks that you opened every evidence tool, read the KB article (where one exists) and confirmed the evidence with a successful read-only SQL query against the ticket's table. **Communication Clarity** checks the reply for the customer's name, a concrete next step, a realistic timeframe, no jargon dumps, and no banned over-promising phrases; it also flags full card numbers (Luhn-checked), BVNs and secret keys. **Escalation Judgment** requires the right team with the ticket-specific payload attached, and penalises escalating a ticket that should have been self-resolved. Tool Efficiency is 0 with no evidence tools recorded, 1 with only some, 2 with all evidence tools but missing KB or SQL confirmation, and 3 with every applicable confirmation. A correct root cause scores only 1 while any required evidence tool is unopened. With the other three axes perfect, that means a maximum of 67/100 with no evidence tools recorded, or 73/100 with only some; these are ceilings, not guaranteed scores. The initially visible tool is recorded automatically, but Customer 360 is background context and does not count as evidence. KB credit requires explicitly opening an article; closing it does not remove credit.

Read `content/rubric.md`, including **Known limitations**, before critiquing. The reply checks are rule-based, not language understanding, and the repo says so.

## Run it locally

```bash
cd app
npm install
npm run build      # copies content/ into src/, type-checks, builds
npm test           # scoring, composer checks, SQL worker/guard, persistence, evidence and KB
npm run preview    # http://localhost:4173
```

Hostile pass (needs Playwright's Chromium):

```powershell
cd app
npx playwright install chromium
powershell -File scripts/run-hostile.ps1
```

Focused browser regressions (also requires Playwright and its Chromium):

```bash
cd app
node scripts/regressions.mjs
```

This starts and stops its own local Vite server and isolated browser. It checks all ticket SQL seeds, cross-ticket navigation, simultaneous-tab drafts, reset synchronization, nested evidence, KB disclosure, and unavailable storage. Cross-tab writes are serialized with Web Locks on supported secure origins (HTTPS or localhost); older browsers without Web Locks use best-effort read/merge/write persistence. If storage is unavailable, work remains in memory for the current page only.

## Add or fix a ticket

1. Edit or add `content/tickets/21xx.json`. Keep exactly one `correct: true` root cause and write each distractor so a tool data point contradicts it.
2. `python content/merge_tickets.py` to regenerate `content/tickets.json`.
3. `cd app && npm run build && npm test`. The build copies content first, so the app can never ship stale ticket data.

If you find a ticket where two root-cause options are both defensible, open an issue. That is a content bug and it gets fixed in the open.

## Fictional data

All customers, companies, card numbers (test ranges only), routing numbers (999-prefixed), transaction references, wallet addresses and internal policies are invented for training. Nothing here describes a specific employer.

## License

MIT. See [LICENSE](LICENSE). Ticket content, rubric and code are all covered; reuse them for your own training, hiring exercises or forks with attribution.

