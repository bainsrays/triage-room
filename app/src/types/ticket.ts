// Types describing the ticket content schema. These mirror content/tickets/*.json
// exactly (content JSON wins over any mockup data — see BUILD-NOTES.md).

export interface TicketMessage {
  from: "customer" | string;
  timestamp: string; // ISO 8601, e.g. 2026-08-28T15:10:00+01:00
  text: string;
}

export interface TicketCustomer {
  name: string;
  kyc_tier: string;
  country: string;
  rails: string[];
  account_summary: string;
}

export interface RootCauseOption {
  text: string;
  correct: boolean;
}

export interface ResolutionOption {
  text: string;
  correct: boolean;
  quality: "best" | "acceptable_but_risky" | "wrong";
}

export interface EscalationInfo {
  required: boolean;
  target: string | null;
  /** Payload items the receiving team needs to act (labels match EscalationPanel PAYLOAD_ITEMS). */
  required_payload?: string[];
}

export interface RubricAnchors {
  "0": string;
  "1": string;
  "2": string;
  "3": string;
}

export interface TicketRubric {
  root_cause_accuracy: RubricAnchors;
  tool_efficiency: RubricAnchors;
  compliance_safety: RubricAnchors;
  communication_clarity: RubricAnchors;
  escalation_judgment: RubricAnchors;
}

// Tools are a loosely-typed bag keyed by tool name (customer_360, transaction_log,
// auth_risk_events, kyc_console, merchant_api_console, processor_status,
// partner_status, chargeback_tool, order_log, crypto_deposit_monitor,
// block_explorer_lookup, rates_tool, knowledge_base). Each ticket only includes
// the tools relevant to it. We keep this as Record<string, unknown> at the type
// level and narrow with helpers where structure matters (e.g. SQL table seeding).
export type TicketTools = Record<string, unknown>;

export interface Ticket {
  id: string;
  title: string;
  track: string;
  difficulty: "easy" | "medium" | "hard";
  channel: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  sla_minutes: number;
  customer: TicketCustomer;
  messages: TicketMessage[];
  hidden_root_cause: string;
  red_herring: string;
  tools: TicketTools;
  root_cause_options: RootCauseOption[];
  resolution_options: ResolutionOption[];
  escalation: EscalationInfo;
  customer_expectation_timeframe: string;
  model_reply: string;
  rubric: TicketRubric;
}

export interface TicketsFile {
  tickets: Ticket[];
}
