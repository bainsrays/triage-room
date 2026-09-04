# Triage Room — Scoring Rubric & Tone Rules

This is the same rubric shown in the app's "why this was scored this way" debrief panel. Nothing here is hidden from the user after they complete a ticket — the goal is transparency, not gotchas.

## 5 competency dimensions

Every ticket scores 0–3 on each of these five dimensions. A perfect ticket score is 15/15 (displayed as /100 in the app via a fixed weighting, but the anchors below are what actually earn the points).

### 1. Root-Cause Accuracy
Did you find the *actual* mechanism behind the symptom, not just a plausible-sounding guess?

- **0** — Picked a root cause contradicted by the evidence (e.g., called it fraud when KYC/auth logs show a clean, verified customer).
- **1** — Landed on the right general category ("a bank issue", "a network problem") but didn't cite the specific evidence that proves it.
- **2** — Correctly identified the mechanism but missed a secondary detail that matters for the reply (e.g., found the network mismatch but didn't note funds are recoverable, not lost).
- **3** — Correctly named the precise mechanism *and* tied it directly to the specific data point(s) in the tools that prove it (a status code, a timestamp gap, a field diff, a rate history point).

### 2. Tool Efficiency
Did you check evidence *before* committing to a diagnosis, and did you check the *right* tools?

- **0** — Diagnosed or resolved without opening any relevant tool.
- **1** — Opened one relevant tool but missed others that were needed to confirm the cause.
- **2** — Opened the right tools but skipped a confirmation step: the Knowledge Base article that states the actual policy (where the ticket has one), or the read-only SQL query against the ticket's seeded table.
- **3** — Opened every tool relevant to this ticket's evidence trail (transaction/webhook/auth logs, crypto monitor, rates — whichever apply), confirmed the evidence with a successful read-only SQL query against the ticket's table, *and* read the relevant KB article (where one exists) before diagnosing.

### 3. Compliance Safety
Did you avoid the classic support mistakes that create real legal, financial, or security exposure?

- **0** — Did something actively unsafe: shared a full API key/card number, promised a guaranteed refund/outcome the policy doesn't support, advised an action that risks a duplicate payment or unauthorized credit, or unilaterally overrode a control that requires sign-off.
- **1** — Avoided the worst mistake but was vague about *why* something is risky, or missed a smaller safety step.
- **2** — Followed the safe path but didn't explain the reasoning to the customer, which can create the same problem later.
- **3** — Took the compliant path *and* explained the "why" — e.g., explicitly told a customer not to resend a payment and said why, or declined to share a full secret key and said why.

### 4. Communication Clarity
Would a real customer or merchant understand this reply and feel handled well, without jargon or unnecessary alarm?

- **0** — Reply is jargon-heavy (internal codes, system names dumped on the customer), blames the customer/partner unhelpfully, or ignores the emotional stakes (urgency, fear, frustration) in their message.
- **1** — Plain language, but missing a concrete next step or timeframe.
- **2** — Concrete next step and timeframe, but doesn't acknowledge the customer's specific situation (e.g., their supplier is waiting, their rent is due).
- **3** — Plain language, acknowledges the customer's specific situation, states the cause in accessible terms, gives one concrete next step, and gives a realistic timeframe.

### 5. Escalation Judgment
Did you route this to the right place — or correctly *not* escalate when the case is self-resolvable?

- **0** — Escalated something routine to a team that doesn't need to be involved, or failed to escalate something that genuinely needs another team's action (e.g., a manual reversal trigger, a partner-bank manual match).
- **1** — Escalated (or didn't) but to/from the wrong team.
- **2** — Escalated correctly (or correctly didn't) but without stating why, or without specifying the exact action needed from that team.
- **3** — Escalated to the exact right team with a clear ask (or correctly resolved without escalation, with reasoning), matching what a senior support engineer would do.

## Tone rules (enforced on every reply, all 11 tickets)

These are checked automatically as part of Communication Clarity and Compliance Safety, and shown as red flags in the debrief if violated:

1. **No over-promising.** Never say a refund/credit/outcome is guaranteed, instant, or "100% safe" unless policy genuinely guarantees it. Say what's likely and give a real timeframe instead.
2. **Never confirm or deny an AML/compliance hold's existence or reasoning to the customer** beyond what policy allows to disclose. (No ticket in v1 requires this disclosure — it's a trap to avoid inventing detail.)
3. **Never share full secret keys, full card numbers, or other sensitive data back to a customer or merchant**, even to help them debug. Prefixes, last 4 digits, and timestamps are fine.
4. **No blame language** directed at the customer, a partner bank, or a merchant when the actual cause is systemic, timing-related, or a shared mistake. State facts; don't assign fault where it doesn't help.
5. **Plain language over jargon.** Internal terms (processor response codes, HTTP status codes, internal queue names) should be translated into what they mean for the person reading the reply — not pasted in raw.
6. **Always give a concrete timeframe**, even when the honest answer is "this will take longer than you want" (see INC-2110). Honesty beats false reassurance.
7. **Never advise an action that risks a duplicate payment, unauthorized credit, or bypassing a control that needs sign-off** (e.g., resending a stuck transfer, crediting a wallet before a partner bank confirms a match).

## Note on the fixed evidence design (v1)

Every ticket's tool data, red herring, and correct answers are fixed and curated (not AI-generated on the fly) — this is a deliberate choice so that the rubric anchors above are reliable and reviewable, the same way a well-designed training exercise or interview case study is fixed rather than randomized. All company names, transaction references, and specific figures in this simulator are fictional and for training/demonstration purposes only.


## Known limitations (read this before you critique)

Naming these first, because they are real.

1. **Reply scoring is rule-based, not language understanding.** The engine checks what a QA lead checks first: the customer is addressed by name, a concrete next step exists, a realistic timeframe is stated, no banned over-promising phrases, no full card number / BVN / secret key pasted back. A determined person can satisfy those checks with a mediocre reply. That is why the reference reply is shown after submission for honest self-comparison, and why no "AI grading" is claimed anywhere.
2. **Root cause and resolution are multiple choice.** Real queues also force you into fixed disposition codes, but writing a diagnosis from scratch is harder than picking one. The skill this simulator enforces is evidence *before* diagnosis: guessing the right answers without opening the tools caps the score at 73/100.
3. **Eleven tickets.** Each one was hand-checked by a domain review pass (KYC tiers, NIP settlement clock, wire identifiers, chain decimals, FX math). Eleven verified scenarios were chosen over hundreds of generated ones. The ticket JSON is public, so adding a twelfth is a pull request, not a rebuild.
4. **One option is marked correct.** Every distractor is written so the tool data contradicts it. If you find a ticket where two options are both defensible, that is a content bug; open an issue and it will be fixed in the open.
5. **No backend, no accounts, no leaderboard.** Progress lives in your browser's local storage and the score card is a client-side PNG. Nothing is collected, so there is nothing to breach. The trade-off is that scores are self-reported.
6. **All data is fictional.** Company names, customers, card numbers (test-range only), routing numbers (999-prefixed), transaction references, and wallet addresses are invented for training. Policy statements reflect common industry practice, not any specific employer's rules.
7. **Timeframe matching is approximate.** The clarity check looks for a stated duration in the reply; it does not verify the number against policy. The rubric anchors handle that judgement, not the regex.