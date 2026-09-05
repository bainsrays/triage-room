import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ticketsFile from "../content/tickets.json";
import ToolPanel from "./ToolPanel";

function renderEvidence(data: unknown) {
  return renderToStaticMarkup(createElement(ToolPanel, { toolKey: "evidence", data }));
}

function ticketTool(ticketId: string, toolKey: string) {
  const ticket = ticketsFile.tickets.find((ticket) => ticket.id === ticketId)!;
  return (ticket.tools as Record<string, unknown>)[toolKey];
}

describe("ToolPanel evidence rendering", () => {
  it("renders the nested INC-2109 suspense entry instead of stringifying it", () => {
    const html = renderEvidence(ticketTool("INC-2109", "partner_status"));
    for (const evidence of ["Unapplied/Suspense Inbound Wires", "amount usd", "1200", "2026-08-28", "OLAMIDE FASHOLA", "MISSING", "AWAITING_MANUAL_MATCH", "queue position", "14"]) {
      expect(html).toContain(evidence);
    }
    expect(html).not.toContain("[object Object]");
  });

  it("keeps INC-2103 risk metadata alongside the auth event table", () => {
    const html = renderEvidence(ticketTool("INC-2103", "auth_risk_events"));
    for (const evidence of ["<table", "ACCOUNT_LOCKED", "risk score", "threshold for lock", "62", "60", "Score driven by device+geo novelty"]) {
      expect(html).toContain(evidence);
    }
  });

  it("keeps partner terminal settlement, match data, and notes beside nested tables", () => {
    const html = renderEvidence({ partner: {
      columns: ["reference"], rows: [{ reference: "AUTH-123" }],
      terminal_settlement: { status: "SETTLED", batches: [{ match: { score: 97, reference: "MATCH-456" } }] },
      note: "Keep this reconciliation note",
    } });
    for (const evidence of ["AUTH-123", "terminal settlement", "SETTLED", "97", "MATCH-456", "Keep this reconciliation note"]) {
      expect(html).toContain(evidence);
    }
  });

  it("keeps notes on empty tables and renders status history only once", () => {
    const html = renderEvidence({
      columns: ["reference"], rows: [], note: "No credit applied yet",
      status_history: [{ timestamp: "2026-08-28T12:00:00Z", status: "PENDING", note: "Awaiting partner" }],
    });
    expect(html).toContain("No rows returned.");
    expect(html).toContain("No credit applied yet");
    expect(html.match(/Awaiting partner/g)).toHaveLength(1);
    expect(html).toContain("<time");
  });

  it("recurses through array entries and table cells, including mixed values", () => {
    const html = renderEvidence([{ values: [[{ proof: "deep-proof" }], null, false], table: {
      columns: ["entry"], rows: [{ entry: { receipt: ["receipt-789", { confirmed: true }] } }],
      note: "Deep table note",
    } }]);
    for (const evidence of ["deep-proof", "false", "receipt-789", "true", "Deep table note", "<table", "\u2014"]) {
      expect(html).toContain(evidence);
    }
    expect(html).not.toContain("[object Object]");
  });

  it("escapes evidence text rather than interpreting it as markup", () => {
    const html = renderEvidence([{ entry: { note: "<script>alert('unsafe')</script>" } }]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
