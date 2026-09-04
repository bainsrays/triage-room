// Pure scoring engine. No DOM, no React, no randomness — same TicketWorkState
// + Ticket in => same TicketScoreResult out, always. This is the module the
// vitest suite in engine.test.ts exercises directly.
//
// Design notes / documented assumptions (content JSON does not encode a
// machine-scorable "correct answer" for every nuance, so these mapping rules
// are a deliberate, consistent design decision — see final build report):
//
// - Tool Efficiency: "evidence tools" for a ticket = every key in ticket.tools
//   except `customer_360` (background context, not diagnostic evidence) and
//   `knowledge_base` (checked separately). This mapping was verified against
//   all 11 tickets' authored rubric anchor text and matches every one exactly
//   (e.g. INC-2101's anchors talk only about Transaction Log + Processor
//   Status + KB, never customer_360; same pattern holds for all others).
// - Root-Cause Accuracy: correctness of the picked option is objective
//   (root_cause_options[i].correct). Depth (1 vs 2 vs 3) is derived from
//   whether all evidence tools were opened before picking, and whether the
//   best-quality resolution was ultimately also chosen (a proxy for "tied the
//   mechanism to the specific data AND to the actionable consequence").
// - Compliance Safety: driven primarily by the deterministic composer checks
//   (no PAN/BVN exposure, no over-promising language) plus the *quality* tag
//   already authored on the chosen resolution_option ("best" /
//   "acceptable_but_risky" / "wrong"), plus a light heuristic for whether the
//   reply explains *why* a safe step matters (rubric level 2 vs 3).
// - Communication Clarity: composer checks (no jargon dumped on the
//   customer) plus heuristics for "states a next step", "states a
//   timeframe", and "acknowledges the customer's specific situation" (shares
//   the customer's first name and at least one substantive word from their
//   opening message).
// - Escalation Judgment: escalation.required + escalation.target from the
//   ticket vs. the user's escalation choice (team routed to + payload
//   completeness), scored on route correctness, not speed.
import type { Ticket } from "../types/ticket";
import type { AxisScore, TicketScoreResult, TicketWorkState } from "../types/session";
import {
  containsTimeframe,
  findBannedPhrases,
  findBvnNumbers,
  findCardNumbers,
  findJargonTerms,
} from "./composerChecks";

const AXIS_LABELS: Record<AxisScore["axisKey"], string> = {
  root_cause_accuracy: "Root-Cause Accuracy",
  tool_efficiency: "Tool Efficiency",
  compliance_safety: "Compliance Safety",
  communication_clarity: "Communication Clarity",
  escalation_judgment: "Escalation Judgment",
};

function clampScore(n: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.round(n))) as 0 | 1 | 2 | 3;
}

function anchorReason(ticket: Ticket, axisKey: AxisScore["axisKey"], score: number): string {
  return ticket.rubric[axisKey][String(score) as "0" | "1" | "2" | "3"];
}

export function evidenceToolKeys(ticket: Ticket): string[] {
  return Object.keys(ticket.tools).filter((k) => k !== "customer_360" && k !== "knowledge_base" && k !== "sql_scratchpad");
}

export function scoreToolEfficiency(ticket: Ticket, work: TicketWorkState): AxisScore {
  const required = evidenceToolKeys(ticket);
  const openedKeys = new Set(work.toolOpens.map((o) => o.toolKey));
  const openedRequired = required.filter((k) => openedKeys.has(k));

  // KB only counts when the ticket actually has KB articles (INC-2102 has none).
  const kbArticles = ticket.tools.knowledge_base;
  const hasKb = Array.isArray(kbArticles) && kbArticles.length > 0;
  const kbOk = !hasKb || work.knowledgeBaseOpened;

  // SQL confirmation: the rubric's band-3 anchors all credit "confirmed via the SQL query", so a
  // successful, read-only query against the ticket's seeded table is required for 3/3 whenever the
  // ticket ships a table. A rejected or errored query does not count.
  const sqlTable = (ticket.tools.sql_scratchpad as { table?: string } | undefined)?.table;
  const sqlAvailable = typeof sqlTable === "string" && sqlTable.length > 0;
  const sqlConfirmed =
    sqlAvailable &&
    (work.sqlQueries ?? []).some(
      (q) => q.allowed && !q.errorMessage && q.query.toLowerCase().includes(sqlTable.toLowerCase())
    );
  const sqlOk = !sqlAvailable || sqlConfirmed;

  let score: 0 | 1 | 2 | 3;
  if (openedRequired.length === 0) {
    score = 0;
  } else if (openedRequired.length < required.length) {
    score = 1;
  } else if (!kbOk || !sqlOk) {
    score = 2;
  } else {
    score = 3;
  }

  const reasons = [anchorReason(ticket, "tool_efficiency", score)];
  reasons.push(
    `Opened ${openedRequired.length}/${required.length} relevant tool(s): ${
      required.length ? required.join(", ") : "(none required beyond context)"
    }.`
  );
  if (hasKb) reasons.push(work.knowledgeBaseOpened ? "Knowledge Base article was opened." : "Knowledge Base article was not opened.");
  else reasons.push("This ticket has no Knowledge Base article, so none was required.");
  if (sqlAvailable) {
    reasons.push(
      sqlConfirmed
        ? `Confirmed the evidence with a successful SQL query against ${sqlTable}.`
        : `Did not confirm the evidence with a SQL query against ${sqlTable} (the scratchpad was available).`
    );
  }

  return { axisKey: "tool_efficiency", axisLabel: AXIS_LABELS.tool_efficiency, score, reasons };
}

export function scoreRootCauseAccuracy(ticket: Ticket, work: TicketWorkState): AxisScore {
  const idx = work.selectedRootCauseIndex;
  const picked = idx !== null && idx >= 0 && idx < ticket.root_cause_options.length ? ticket.root_cause_options[idx] : null;
  const correct = !!picked?.correct;

  const required = evidenceToolKeys(ticket);
  const openedKeys = new Set(work.toolOpens.map((o) => o.toolKey));
  const allEvidenceOpened = required.length === 0 || required.every((k) => openedKeys.has(k));

  const resIdx = work.selectedResolutionIndex;
  const pickedResolution =
    resIdx !== null && resIdx >= 0 && resIdx < ticket.resolution_options.length ? ticket.resolution_options[resIdx] : null;
  const bestResolutionChosen = pickedResolution?.quality === "best";

  let score: 0 | 1 | 2 | 3;
  if (!correct) {
    score = 0;
  } else if (!allEvidenceOpened) {
    score = 1;
  } else if (!bestResolutionChosen) {
    score = 2;
  } else {
    score = 3;
  }

  const reasons = [anchorReason(ticket, "root_cause_accuracy", score)];
  reasons.push(
    picked
      ? `You selected: "${picked.text}" (${correct ? "matches the evidence" : "contradicted by the evidence"}).`
      : "No root cause was selected."
  );

  return { axisKey: "root_cause_accuracy", axisLabel: AXIS_LABELS.root_cause_accuracy, score, reasons };
}

const BLAME_PHRASES = [
  "your fault",
  "you should have",
  "you did not",
  "you didn't",
  "the merchant's fault",
  "their fault",
  "you made a mistake",
  "customer error",
];

// Verified against all 11 authored model_reply values so a reference-quality
// reply always registers as "explains the why" (rubric level 2 -> 3 for
// Compliance Safety).
const CAUSAL_MARKERS = [
  "because", "so that", "in order to", "this is why", "the reason", "which means", "that means",
  "so it", "which is why", "that's why", "so our", "so you", "so we", "so the", "for security",
  "would close", "would end up", "end up", "doing so would", "given that", "given the", "since this", "since that",
  "as a stopgap", "in the meantime", "without waiting",
];
function explainsWhy(reply: string): boolean {
  const lower = reply.toLowerCase();
  return CAUSAL_MARKERS.some((m) => lower.includes(m));
}

export function scoreComplianceSafety(ticket: Ticket, work: TicketWorkState): AxisScore {
  const reply = work.replyDraft;
  const hasCard = findCardNumbers(reply).length > 0;
  const hasBvn = findBvnNumbers(reply).length > 0;
  const banned = findBannedPhrases(reply);

  const resIdx = work.selectedResolutionIndex;
  const pickedResolution =
    resIdx !== null && resIdx >= 0 && resIdx < ticket.resolution_options.length ? ticket.resolution_options[resIdx] : null;

  let score: 0 | 1 | 2 | 3;
  if (hasCard || hasBvn || banned.length > 0) {
    score = 0;
  } else if (!pickedResolution || pickedResolution.quality === "wrong") {
    score = 1;
  } else if (pickedResolution.quality === "acceptable_but_risky") {
    score = 1;
  } else if (!explainsWhy(reply)) {
    score = 2;
  } else {
    score = 3;
  }

  const reasons = [anchorReason(ticket, "compliance_safety", score)];
  if (hasCard) reasons.push("Reply exposes a full card-number-like value.");
  if (hasBvn) reasons.push("Reply exposes a full BVN-like value.");
  if (banned.length > 0) reasons.push(`Reply uses over-promising language: "${banned.join('", "')}".`);
  if (pickedResolution) {
    reasons.push(`Resolution chosen was rated "${pickedResolution.quality.replace(/_/g, " ")}" in this scenario's design.`);
  }
  return { axisKey: "compliance_safety", axisLabel: AXIS_LABELS.compliance_safety, score, reasons };
}

const NEXT_STEP_MARKERS = [
  "i have",
  "i've",
  "we have",
  "we've",
  "i will",
  "we will",
  "i'll",
  "we'll",
  "i can",
  "we can",
  "please do not",
  "please don't",
  "next step",
  "in the meantime",
  "i've raised",
  "i have raised",
  "i'm opening",
  "i am opening",
  "i'm requerying",
  "i'll offer",
  "i can offer",
  "will help",
];

const STOPWORDS = new Set([
  "about","after","again","apologize","because","before","cannot","could","doesn","during","first","little","might","other","please","should","their","there","these","thing","things","think","those","which","would","today","still","urgent","urgently"
]);

function acknowledgesSituation(ticket: Ticket, reply: string): boolean {
  const lowerReply = reply.toLowerCase();
  const firstName = ticket.customer.name.split(" ")[0]?.toLowerCase();
  const nameMentioned = !!firstName && lowerReply.includes(firstName);

  const firstMessage = ticket.messages[0]?.text ?? "";
  const words = firstMessage
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 6 && !STOPWORDS.has(w));
  // Stem-match (first 5 chars) rather than exact-substring, so "quoted" in the
  // customer's message still counts as acknowledged by a reply that says
  // "quote" (verified against all 11 tickets' model_reply text).
  const sharesWord = words.some((w) => lowerReply.includes(w) || lowerReply.includes(w.slice(0, 5)));

  return nameMentioned && sharesWord;
}

export function scoreCommunicationClarity(ticket: Ticket, work: TicketWorkState): AxisScore {
  const reply = work.replyDraft;
  const lower = reply.toLowerCase();
  const jargon = findJargonTerms(reply);
  const blame = BLAME_PHRASES.filter((p) => lower.includes(p));

  const hasNextStep = NEXT_STEP_MARKERS.some((m) => lower.includes(m));
  const hasTimeframe = containsTimeframe(reply, ticket.customer_expectation_timeframe);
  const acknowledges = acknowledgesSituation(ticket, reply);

  let score: 0 | 1 | 2 | 3;
  if (reply.trim().length === 0 || jargon.length > 0 || blame.length > 0) {
    score = 0;
  } else if (!hasNextStep || !hasTimeframe) {
    score = 1;
  } else if (!acknowledges) {
    score = 2;
  } else {
    score = 3;
  }

  const reasons = [anchorReason(ticket, "communication_clarity", score)];
  if (jargon.length > 0) reasons.push(`Internal jargon found: "${jargon.join('", "')}".`);
  if (blame.length > 0) reasons.push(`Blame language found: "${blame.join('", "')}".`);
  reasons.push(hasNextStep ? "A concrete next step is stated." : "No concrete next step was found.");
  reasons.push(hasTimeframe ? "A timeframe close to the expected one is stated." : "No matching timeframe was found.");
  reasons.push(acknowledges ? "Reply acknowledges the customer by name and their specific situation." : "Reply does not clearly acknowledge the customer's specific situation.");

  return { axisKey: "communication_clarity", axisLabel: AXIS_LABELS.communication_clarity, score, reasons };
}

const TEAM_ALIASES: Record<string, string[]> = {
  "Payments Ops": ["payments ops", "payment ops"],
  Compliance: ["compliance"],
  "Crypto Ops": ["crypto ops"],
  "Treasury Ops": ["treasury ops"],
  Engineering: ["engineering", "eng"],
};

function extractTeamName(target: string): string {
  return target.split(" (")[0].trim();
}

export function scoreEscalationJudgment(ticket: Ticket, work: TicketWorkState): AxisScore {
  const esc = work.escalation;
  const didEscalate = !!esc?.didEscalate;
  const required = ticket.escalation.required;

  let score: 0 | 1 | 2 | 3;
  const reasons: string[] = [];

  if (!required) {
    if (!didEscalate) {
      score = 3;
      reasons.push(anchorReason(ticket, "escalation_judgment", 3));
      reasons.push("Correctly resolved without creating an unnecessary escalation.");
    } else {
      score = 0;
      reasons.push(anchorReason(ticket, "escalation_judgment", 0));
      reasons.push(`Escalated to "${esc?.routedTo ?? "(unspecified)"}" when this ticket did not require escalation.`);
    }
  } else {
    if (!didEscalate) {
      score = 0;
      reasons.push(anchorReason(ticket, "escalation_judgment", 0));
      reasons.push("This ticket needed to be escalated, but no escalation was raised.");
    } else {
      const expectedTeam = ticket.escalation.target ? extractTeamName(ticket.escalation.target) : null;
      const aliases = expectedTeam ? TEAM_ALIASES[expectedTeam] ?? [expectedTeam.toLowerCase()] : [];
      const routedLower = (esc?.routedTo ?? "").toLowerCase();
      const correctTeam = expectedTeam ? aliases.some((a) => routedLower.includes(a)) : false;
      // Payload completeness is ticket-specific: the receiving team must be able to act without
      // coming back to support. If the content names required items, ALL of them must be attached;
      // otherwise fall back to "at least 2 items".
      const attached = esc?.payloadItems ?? [];
      const requiredPayload = ticket.escalation.required_payload ?? [];
      const missingPayload = requiredPayload.filter((item) => !attached.includes(item));
      const payloadOk = requiredPayload.length > 0 ? missingPayload.length === 0 : attached.length >= 2;

      if (!correctTeam) {
        score = 1;
        reasons.push(anchorReason(ticket, "escalation_judgment", 1));
        reasons.push(`Routed to "${esc?.routedTo ?? "(unspecified)"}"; expected "${expectedTeam ?? "the correct team"}".`);
      } else if (!payloadOk) {
        score = 2;
        reasons.push(anchorReason(ticket, "escalation_judgment", 2));
        reasons.push(
          requiredPayload.length > 0
            ? `Routed to the correct team, but the escalation is missing what ${expectedTeam} needs to act: ${missingPayload.join(", ")}.`
            : "Routed to the correct team, but attached fewer than 2 payload items to support the ask."
        );
      } else {
        score = 3;
        reasons.push(anchorReason(ticket, "escalation_judgment", 3));
        reasons.push(
          requiredPayload.length > 0
            ? `Routed to "${expectedTeam}" with everything they need attached (${requiredPayload.join(", ")}).`
            : `Routed to "${expectedTeam}" with ${attached.length} payload item(s) attached.`
        );
      }
    }
  }

  return { axisKey: "escalation_judgment", axisLabel: AXIS_LABELS.escalation_judgment, score: clampScore(score), reasons };
}

export function scoreTicket(ticket: Ticket, work: TicketWorkState): TicketScoreResult {
  const axes = [
    scoreRootCauseAccuracy(ticket, work),
    scoreToolEfficiency(ticket, work),
    scoreComplianceSafety(ticket, work),
    scoreCommunicationClarity(ticket, work),
    scoreEscalationJudgment(ticket, work),
  ];
  const totalRaw = axes.reduce((sum, a) => sum + a.score, 0);
  const totalDisplay = Math.round((totalRaw / 15) * 100);
  return { ticketId: ticket.id, axes, totalRaw, totalDisplay };
}

export { TEAM_ALIASES };
