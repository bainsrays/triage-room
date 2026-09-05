// Per-ticket working state captured while the user works a ticket, plus the
// aggregate shift/localStorage state shape. Kept separate from ticket.ts
// (content schema) since this is app-owned state, not content.

export interface ToolOpenEvent {
  toolKey: string;
  openedAt: number; // epoch ms, wall clock (for ordering/debug only — not shown to the "customer")
}

export interface SqlQueryEvent {
  query: string;
  ranAt: number;
  allowed: boolean;
  rowCount?: number;
  errorMessage?: string;
}

export interface EscalationChoice {
  routedTo: string | null; // free text team name the user typed/selected
  payloadItems: string[]; // items the user marked as attached, e.g. "tx hash", "reference"
  didEscalate: boolean;
  chosenAt: number;
}

export interface TicketWorkState {
  ticketId: string;
  status: "new" | "in_progress" | "resolved";
  toolOpens: ToolOpenEvent[];
  knowledgeBaseOpened: boolean;
  sqlQueries: SqlQueryEvent[];
  selectedRootCauseIndex: number | null;
  selectedResolutionIndex: number | null;
  escalation: EscalationChoice | null;
  replyDraft: string;
  submittedAt: number | null;
  startedAt: number | null;
}

export interface AxisScore {
  axisKey: "root_cause_accuracy" | "tool_efficiency" | "compliance_safety" | "communication_clarity" | "escalation_judgment";
  axisLabel: string;
  score: 0 | 1 | 2 | 3;
  reasons: string[];
}

export interface TicketScoreResult {
  ticketId: string;
  axes: AxisScore[];
  totalRaw: number; // 0-15
  totalDisplay: number; // 0-100, fixed weighting (totalRaw / 15 * 100, rounded)
}

export const SHIFT_STATE_STORAGE_KEY = "triageroom.shiftState.v1";
export const SHIFT_STATE_SCHEMA_VERSION = 1;

export interface ShiftState {
  schemaVersion: number;
  resetId?: string;
  shiftStartedAt: number | null;
  tickets: Record<string, TicketWorkState>;
  scores: Record<string, TicketScoreResult>;
}

export function emptyTicketWorkState(ticketId: string): TicketWorkState {
  return {
    ticketId,
    status: "new",
    toolOpens: [],
    knowledgeBaseOpened: false,
    sqlQueries: [],
    selectedRootCauseIndex: null,
    selectedResolutionIndex: null,
    escalation: null,
    replyDraft: "",
    submittedAt: null,
    startedAt: null,
  };
}

export function emptyShiftState(): ShiftState {
  return {
    schemaVersion: SHIFT_STATE_SCHEMA_VERSION,
    shiftStartedAt: null,
    tickets: {},
    scores: {},
  };
}
