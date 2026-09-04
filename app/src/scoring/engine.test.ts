import { describe, expect, it } from "vitest";
import ticketsFile from "../content/tickets.json";
import type { Ticket, TicketsFile } from "../types/ticket";
import { emptyTicketWorkState } from "../types/session";
import type { TicketWorkState } from "../types/session";
import {
  evidenceToolKeys,
  scoreCommunicationClarity,
  scoreComplianceSafety,
  scoreEscalationJudgment,
  scoreRootCauseAccuracy,
  scoreToolEfficiency,
  scoreTicket,
} from "./engine";

const tickets = (ticketsFile as TicketsFile).tickets;
function getTicket(id: string): Ticket {
  const t = tickets.find((x) => x.id === id);
  if (!t) throw new Error(`fixture ticket ${id} not found`);
  return t;
}

function correctRootCauseIndex(ticket: Ticket): number {
  return ticket.root_cause_options.findIndex((o) => o.correct);
}
function bestResolutionIndex(ticket: Ticket): number {
  return ticket.resolution_options.findIndex((o) => o.quality === "best");
}
function wrongResolutionIndex(ticket: Ticket): number {
  return ticket.resolution_options.findIndex((o) => o.quality === "wrong");
}
function incorrectRootCauseIndex(ticket: Ticket): number {
  return ticket.root_cause_options.findIndex((o) => !o.correct);
}

describe("evidenceToolKeys", () => {
  it("excludes customer_360 and knowledge_base", () => {
    const ticket = getTicket("INC-2101");
    expect(evidenceToolKeys(ticket)).toEqual(["transaction_log", "processor_status"]);
  });

  it("for INC-2110 returns crypto_deposit_monitor and block_explorer_lookup", () => {
    const ticket = getTicket("INC-2110");
    expect(evidenceToolKeys(ticket).sort()).toEqual(["block_explorer_lookup", "crypto_deposit_monitor"].sort());
  });
});

function fullyWorkedState(ticket: Ticket): TicketWorkState {
  const work = emptyTicketWorkState(ticket.id);
  work.toolOpens = evidenceToolKeys(ticket).map((k, i) => ({ toolKey: k, openedAt: Date.now() + i }));
  work.knowledgeBaseOpened = true;
  const table = (ticket.tools.sql_scratchpad as { table?: string } | undefined)?.table;
  if (table) work.sqlQueries = [{ query: `SELECT * FROM ${table} LIMIT 10;`, ranAt: Date.now(), allowed: true, rowCount: 1 }];
  work.selectedRootCauseIndex = correctRootCauseIndex(ticket);
  work.selectedResolutionIndex = bestResolutionIndex(ticket);
  work.replyDraft = ticket.model_reply;
  if (ticket.escalation.required) {
    work.escalation = {
      routedTo: ticket.escalation.target ?? "",
      payloadItems: ticket.escalation.required_payload ?? ["reference", "evidence", "timeline"],
      didEscalate: true,
      chosenAt: Date.now(),
    };
  } else {
    work.escalation = {
      routedTo: null,
      payloadItems: [],
      didEscalate: false,
      chosenAt: Date.now(),
    };
  }
  return work;
}

describe("scoreTicket — perfect run scores 15/15 (100)", () => {
  for (const ticket of tickets) {
    it(`${ticket.id}: perfect play scores 15/15`, () => {
      const work = fullyWorkedState(ticket);
      const result = scoreTicket(ticket, work);
      expect(result.totalRaw).toBe(15);
      expect(result.totalDisplay).toBe(100);
      for (const axis of result.axes) {
        expect(axis.score).toBe(3);
      }
    });
  }
});

describe("scoreTicket — bad run scores low", () => {
  it("INC-2101: wrong root cause, no tools opened, empty reply, no escalation scores badly", () => {
    const ticket = getTicket("INC-2101");
    const work = emptyTicketWorkState(ticket.id);
    work.selectedRootCauseIndex = incorrectRootCauseIndex(ticket);
    work.selectedResolutionIndex = wrongResolutionIndex(ticket);
    work.replyDraft = "";
    work.escalation = { routedTo: null, payloadItems: [], didEscalate: false, chosenAt: Date.now() };

    const result = scoreTicket(ticket, work);
    expect(result.totalRaw).toBeLessThanOrEqual(2);
    const rootCause = result.axes.find((a) => a.axisKey === "root_cause_accuracy")!;
    expect(rootCause.score).toBe(0);
    const toolEff = result.axes.find((a) => a.axisKey === "tool_efficiency")!;
    expect(toolEff.score).toBe(0);
    const escalation = result.axes.find((a) => a.axisKey === "escalation_judgment")!;
    expect(escalation.score).toBe(0); // ticket requires escalation; none was raised
  });
});

describe("scoreEscalationJudgment — unnecessary escalation penalty", () => {
  it("penalises escalating a ticket that does not require escalation (INC-2102)", () => {
    const ticket = getTicket("INC-2102"); // escalation.required === false
    expect(ticket.escalation.required).toBe(false);
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = {
      routedTo: "Compliance",
      payloadItems: ["reference"],
      didEscalate: true,
      chosenAt: Date.now(),
    };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("rewards correctly not escalating when not required (INC-2102)", () => {
    const ticket = getTicket("INC-2102");
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = { routedTo: null, payloadItems: [], didEscalate: false, chosenAt: Date.now() };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(3);
  });

  it("scores 0 when a required escalation is skipped (INC-2101)", () => {
    const ticket = getTicket("INC-2101");
    expect(ticket.escalation.required).toBe(true);
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = { routedTo: null, payloadItems: [], didEscalate: false, chosenAt: Date.now() };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("scores 1 when escalated to the wrong team (INC-2101 -> Compliance instead of Payments Ops)", () => {
    const ticket = getTicket("INC-2101");
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = { routedTo: "Compliance", payloadItems: ["a", "b"], didEscalate: true, chosenAt: Date.now() };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(1);
  });

  it("scores 2 when escalated to the right team but with a thin payload (INC-2101)", () => {
    const ticket = getTicket("INC-2101");
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = { routedTo: "Payments Ops", payloadItems: ["reference"], didEscalate: true, chosenAt: Date.now() };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(2);
  });

  it("INC-2110: right team but WRONG attachments (no tx hash / network) is only 2/3 and names what is missing", () => {
    const ticket = getTicket("INC-2110");
    expect(ticket.escalation.required_payload).toEqual(["Tx hash / block explorer link", "Network / rail name"]);
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = {
      routedTo: "Crypto Ops",
      payloadItems: ["Timeline of events", "Customer evidence (screenshot, doc)"], // 2 items, but not the ones Crypto Ops needs
      didEscalate: true,
      chosenAt: Date.now(),
    };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(2);
    expect(axis.reasons.join(" ")).toMatch(/Tx hash \/ block explorer link/);
    expect(axis.reasons.join(" ")).toMatch(/Network \/ rail name/);
  });

  it("INC-2110: right team with tx hash + network attached is 3/3", () => {
    const ticket = getTicket("INC-2110");
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = {
      routedTo: "Crypto Ops",
      payloadItems: ["Tx hash / block explorer link", "Network / rail name"],
      didEscalate: true,
      chosenAt: Date.now(),
    };
    expect(scoreEscalationJudgment(ticket, work).score).toBe(3);
  });

  it("every required-escalation ticket declares required_payload using labels the UI can actually attach", () => {
    const uiLabels = ["Transaction reference", "Tx hash / block explorer link", "Timeline of events", "Customer evidence (screenshot, doc)", "Network / rail name"];
    for (const t of tickets.filter((x) => x.escalation.required)) {
      expect(t.escalation.required_payload, `${t.id} missing required_payload`).toBeTruthy();
      for (const item of t.escalation.required_payload!) expect(uiLabels).toContain(item);
    }
  });

  it("handles INC-2108's required=false with a non-null target string without crashing", () => {
    const ticket = getTicket("INC-2108");
    expect(ticket.escalation.required).toBe(false);
    expect(ticket.escalation.target).not.toBeNull();
    const work = emptyTicketWorkState(ticket.id);
    work.escalation = { routedTo: null, payloadItems: [], didEscalate: false, chosenAt: Date.now() };
    const axis = scoreEscalationJudgment(ticket, work);
    expect(axis.score).toBe(3);
  });
});

describe("scoreRootCauseAccuracy", () => {
  it("scores 0 for a root cause contradicted by the evidence", () => {
    const ticket = getTicket("INC-2103");
    const work = emptyTicketWorkState(ticket.id);
    work.selectedRootCauseIndex = incorrectRootCauseIndex(ticket);
    const axis = scoreRootCauseAccuracy(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("scores 1 for correct root cause but missing evidence tools", () => {
    const ticket = getTicket("INC-2103");
    const work = emptyTicketWorkState(ticket.id);
    work.selectedRootCauseIndex = correctRootCauseIndex(ticket);
    work.toolOpens = [];
    const axis = scoreRootCauseAccuracy(ticket, work);
    expect(axis.score).toBe(1);
  });

  it("scores 3 for correct root cause, all evidence opened, best resolution chosen", () => {
    const ticket = getTicket("INC-2103");
    const work = emptyTicketWorkState(ticket.id);
    work.selectedRootCauseIndex = correctRootCauseIndex(ticket);
    work.toolOpens = evidenceToolKeys(ticket).map((k) => ({ toolKey: k, openedAt: Date.now() }));
    work.selectedResolutionIndex = bestResolutionIndex(ticket);
    const axis = scoreRootCauseAccuracy(ticket, work);
    expect(axis.score).toBe(3);
  });
});

describe("scoreToolEfficiency", () => {
  it("scores 0 when no evidence tool is opened", () => {
    const ticket = getTicket("INC-2105");
    const work = emptyTicketWorkState(ticket.id);
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("scores 1 when only some evidence tools are opened", () => {
    const ticket = getTicket("INC-2105");
    const work = emptyTicketWorkState(ticket.id);
    work.toolOpens = [{ toolKey: "merchant_api_console", openedAt: Date.now() }];
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(1);
  });

  it("scores 2 when all evidence tools opened but KB not read", () => {
    const ticket = getTicket("INC-2105");
    const work = emptyTicketWorkState(ticket.id);
    work.toolOpens = evidenceToolKeys(ticket).map((k) => ({ toolKey: k, openedAt: Date.now() }));
    work.knowledgeBaseOpened = false;
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(2);
  });

  it("scores 3 when all evidence tools + KB opened + SQL confirmed", () => {
    const ticket = getTicket("INC-2105");
    const work = emptyTicketWorkState(ticket.id);
    work.toolOpens = evidenceToolKeys(ticket).map((k) => ({ toolKey: k, openedAt: Date.now() }));
    work.knowledgeBaseOpened = true;
    work.sqlQueries = [{ query: "SELECT status, count(*) FROM webhook_events GROUP BY status", ranAt: 1, allowed: true, rowCount: 1 }];
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(3);
  });

  it("INC-2102 has no KB article and can still reach 3/3 with tools + SQL", () => {
    const ticket = getTicket("INC-2102");
    expect(ticket.tools.knowledge_base).toBeUndefined();
    const work = fullyWorkedState(ticket);
    work.knowledgeBaseOpened = false; // nothing to open
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(3);
    expect(axis.reasons.join(" ")).toMatch(/no Knowledge Base article/);
  });

  it("all tools + KB but NO SQL confirmation is 2/3 and names the table (INC-2110)", () => {
    const ticket = getTicket("INC-2110");
    const work = fullyWorkedState(ticket);
    work.sqlQueries = [];
    const axis = scoreToolEfficiency(ticket, work);
    expect(axis.score).toBe(2);
    expect(axis.reasons.join(" ")).toMatch(/Did not confirm the evidence with a SQL query against crypto_deposits/);
  });

  it("a rejected DROP or an errored SELECT does not count as SQL confirmation", () => {
    const ticket = getTicket("INC-2110");
    const work = fullyWorkedState(ticket);
    work.sqlQueries = [
      { query: "DROP TABLE crypto_deposits", ranAt: 1, allowed: false, errorMessage: "rejected" },
      { query: "SELECT * FROM crypto_deposits WHERE", ranAt: 2, allowed: true, errorMessage: "syntax error" },
    ];
    expect(scoreToolEfficiency(ticket, work).score).toBe(2);
  });
});

describe("scoreComplianceSafety", () => {
  it("scores 0 when the reply leaks a full card number", () => {
    const ticket = getTicket("INC-2106");
    const work = emptyTicketWorkState(ticket.id);
    work.replyDraft = "Your new key is 4111111111111111, please use it.";
    work.selectedResolutionIndex = bestResolutionIndex(ticket);
    const axis = scoreComplianceSafety(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("scores low for a resolution marked wrong even with a clean reply", () => {
    const ticket = getTicket("INC-2106");
    const work = emptyTicketWorkState(ticket.id);
    work.replyDraft = ticket.model_reply;
    work.selectedResolutionIndex = wrongResolutionIndex(ticket);
    const axis = scoreComplianceSafety(ticket, work);
    expect(axis.score).toBeLessThanOrEqual(1);
  });
});

describe("scoreCommunicationClarity", () => {
  it("scores 0 for an empty reply", () => {
    const ticket = getTicket("INC-2109");
    const work = emptyTicketWorkState(ticket.id);
    work.replyDraft = "";
    const axis = scoreCommunicationClarity(ticket, work);
    expect(axis.score).toBe(0);
  });

  it("scores 0 when the reply dumps internal jargon on the customer", () => {
    const ticket = getTicket("INC-2101");
    const work = emptyTicketWorkState(ticket.id);
    work.replyDraft =
      "Hi, your transfer shows processor_response=TIMEOUT and is stuck at SENT_TO_NIBSS in the NIP queue.";
    const axis = scoreCommunicationClarity(ticket, work);
    expect(axis.score).toBe(0);
  });
});

describe("determinism", () => {
  it("scoring the same ticket + work state twice yields identical results", () => {
    const ticket = getTicket("INC-2110");
    const work = fullyWorkedState(ticket);
    const a = scoreTicket(ticket, work);
    const b = scoreTicket(ticket, work);
    expect(a).toEqual(b);
  });
});
