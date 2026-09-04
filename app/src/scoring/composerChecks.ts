// Deterministic, client-side checks run against the agent's reply draft.
// These feed Compliance Safety and Communication Clarity scoring and are also
// shown live to the user while they type (see BUILD-NOTES functional req #3).
import type { Ticket } from "../types/ticket";

export type ComposerCheckSeverity = "danger" | "warning" | "info";

export interface ComposerCheckResult {
  id: string;
  label: string;
  passed: boolean;
  severity: ComposerCheckSeverity;
  detail: string;
}

const BANNED_PHRASES = [
  "100% safe",
  "100% guaranteed",
  "guaranteed",
  "definitely",
  "no risk",
  "risk-free",
  "instant refund",
  "instantly refund",
  "absolutely safe",
  "we promise",
  "i promise",
];

// Internal system terms that should never be pasted raw into a customer-facing
// reply per rubric.md tone rule #5 ("plain language over jargon"). This list is
// derived from the tool/processor vocabulary actually present in the ticket
// content (e.g. NIBSS, processor response codes, internal queue/table names),
// not invented facts — the ticket JSON does not ship an explicit jargon list,
// so this is a documented build-time judgment call (see final report).
//
// Every term below was verified against all 11 authored `model_reply` values
// (the rubric's own reference-quality replies) and does NOT appear in any of
// them — so a perfect-play reply never trips this check. Terms the model
// replies *do* legitimately use in plain-language context (e.g. "webhook" to
// a technical merchant audience, "3DS"/"AVS" explained inline, "ERC-20" /
// "BEP-20" network names that ARE the customer-facing vocabulary for crypto
// rails, "MT103", "off-ramp fee") are intentionally excluded to avoid
// penalising the reference answer itself.
const GLOBAL_JARGON_TERMS = [
  "NIBSS",
  "NIP",
  "processor_response",
  "REVERSAL_INITIATED",
  "SENT_TO_NIBSS",
  "requery worker",
  "requery job",
  "TLS certificate chain",
  "SSL_HANDSHAKE_FAILED",
  "Bearer token",
  "API key prefix",
  "202 Accepted",
  "aggregator incident",
  "retrieval reference number",
  "chargeback reason code",
  "reason code 4834",
  "quote lock",
  "suspense queue",
  "CAPTURED",
  "DEGRADED",
  "BACKLOGGED",
  "vendor_status",
  "wallet_id",
  "auth_risk_events",
  "customer_360",
];

/** Luhn checksum for card-like digit strings. */
export function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface DetectedSpan {
  match: string;
  index: number;
}

/** Finds candidate PAN-like digit runs (13-19 digits, allowing spaces/dashes) that pass Luhn. */
export function findCardNumbers(text: string): DetectedSpan[] {
  const found: DetectedSpan[] = [];
  const candidateRe = /\b(?:\d[ -]?){12,18}\d\b/g;
  let m: RegExpExecArray | null;
  while ((m = candidateRe.exec(text)) !== null) {
    const raw = m[0];
    const digits = raw.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
      found.push({ match: raw, index: m.index });
    }
  }
  return found;
}

/** Finds 11-digit BVN-like numbers (Nigerian Bank Verification Number). */
export function findBvnNumbers(text: string): DetectedSpan[] {
  const found: DetectedSpan[] = [];
  const re = /\b\d{11}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.push({ match: m[0], index: m.index });
  }
  return found;
}

export function findBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p.toLowerCase()));
}

export function findJargonTerms(text: string): string[] {
  return GLOBAL_JARGON_TERMS.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
}

const TIMEFRAME_STOPWORDS = new Set([
  "about", "after", "again", "before", "cannot", "could", "doesn", "during", "first", "little",
  "might", "other", "should", "their", "there", "these", "thing", "things", "think", "those",
  "which", "would", "today", "still", "urgent", "urgently", "within", "business", "confirmed",
]);

/**
 * Loose match between a reply and a ticket's authored customer_expectation_timeframe.
 * Verified against all 11 tickets' own model_reply text (see scripts/_check_timeframe.mjs
 * during development) so a reference-quality reply always passes this check.
 */
export function containsTimeframe(text: string, expected: string): boolean {
  if (!expected) return true;
  const lower = text.toLowerCase();
  const numberTokens = [...expected.matchAll(/\d+(?:-\d+)?/g)].map((m) => m[0]);
  if (numberTokens.some((n) => lower.includes(n.toLowerCase()))) return true;
  const words = expected
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !TIMEFRAME_STOPWORDS.has(w));
  return words.some((w) => lower.includes(w));
}

/** Generic "the reply commits to a time" detector, used before the ticket is revealed so the
 *  live checks never leak the authored expectation to the candidate. */
const GENERIC_TIMEFRAME =
  /\b\d+\s*(?:-|to|–)?\s*\d*\s*(?:minutes?|mins?|hours?|hrs?|days?|business days?|working days?|weeks?)\b|same[- ]day|right away|immediately|straight away|within this (?:chat|session)|tonight|by end of (?:the )?day|end of day|before (?:the )?deadline|by \d{1,2}(?:st|nd|rd|th)? [A-Z][a-z]+/i;

export function runComposerChecks(reply: string, ticket: Ticket, options: { revealed?: boolean } = {}): ComposerCheckResult[] {
  const revealed = options.revealed === true;
  const results: ComposerCheckResult[] = [];

  const cards = findCardNumbers(reply);
  results.push({
    id: "no-full-pan",
    label: "No full card number exposed",
    passed: cards.length === 0,
    severity: "danger",
    detail:
      cards.length === 0
        ? "No 13-19 digit sequence passing a Luhn checksum was found."
        : `Found ${cards.length} card-number-like value(s) that pass the Luhn check: ${cards
            .map((c) => c.match)
            .join(", ")}. Never send a full PAN back to a customer.`,
  });

  const bvns = findBvnNumbers(reply);
  results.push({
    id: "no-full-bvn",
    label: "No full BVN exposed",
    passed: bvns.length === 0,
    severity: "danger",
    detail:
      bvns.length === 0
        ? "No 11-digit BVN-shaped number was found."
        : `Found ${bvns.length} 11-digit number(s) that look like a full BVN: ${bvns
            .map((b) => b.match)
            .join(", ")}. Use masked forms like 221****914 instead.`,
  });

  const banned = findBannedPhrases(reply);
  results.push({
    id: "no-banned-phrases",
    label: "No over-promising language",
    passed: banned.length === 0,
    severity: "warning",
    detail:
      banned.length === 0
        ? "No absolute/guarantee language detected."
        : `Found over-promising phrase(s): "${banned.join('", "')}". Say what's likely and give a real timeframe instead.`,
  });

  const jargon = findJargonTerms(reply);
  results.push({
    id: "no-internal-jargon",
    label: "No internal jargon dumped on the customer",
    passed: jargon.length === 0,
    severity: "warning",
    detail:
      jargon.length === 0
        ? "No internal system terms detected in the reply."
        : `Found internal term(s) that should be translated into plain language: "${jargon.join('", "')}".`,
  });

  const hasTimeframe = containsTimeframe(reply, ticket.customer_expectation_timeframe);
  const hasGenericTimeframe = GENERIC_TIMEFRAME.test(reply);
  results.push({
    id: "states-timeframe",
    label: "States a concrete timeframe",
    // Pre-reveal: pass if the reply commits to ANY concrete time, so the check cannot be gamed
    // into disclosing the answer. Post-reveal: show how it compares to the authored expectation.
    passed: revealed ? hasTimeframe : hasTimeframe || hasGenericTimeframe,
    severity: "info",
    detail: revealed
      ? hasTimeframe
        ? `Reply references the expected timeframe ("${ticket.customer_expectation_timeframe}").`
        : `Expected timeframe was: "${ticket.customer_expectation_timeframe}". The reply did not state it.`
      : hasTimeframe || hasGenericTimeframe
        ? "Reply commits to a concrete time the customer can hold you to."
        : "Tell the customer WHEN they will hear back or see the fix (a number and a unit, or 'within this chat').",
  });

  const wordCount = reply.trim().length === 0 ? 0 : reply.trim().split(/\s+/).length;
  results.push({
    id: "non-empty",
    label: "Reply is not empty",
    passed: wordCount >= 15,
    severity: "info",
    detail: wordCount >= 15 ? `${wordCount} words.` : "Write a full reply before submitting (at least ~15 words).",
  });

  return results;
}

export function composerChecksPassed(results: ComposerCheckResult[]): boolean {
  return results.every((r) => r.passed || r.severity === "info");
}
