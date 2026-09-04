import ticketsFile from "../content/tickets.json";
import type { Ticket, TicketsFile } from "../types/ticket";

export const TICKETS: Ticket[] = (ticketsFile as TicketsFile).tickets;

export function getTicketById(id: string): Ticket | undefined {
  return TICKETS.find((t) => t.id === id);
}

export const TOOL_LABELS: Record<string, string> = {
  customer_360: "Customer 360",
  transaction_log: "Transaction Log",
  processor_status: "Processor Status",
  chargeback_tool: "Chargeback Tool",
  auth_risk_events: "Auth & Risk Events",
  kyc_console: "KYC Console",
  merchant_api_console: "Merchant API Console",
  order_log: "Order Log",
  partner_status: "Partner Status",
  crypto_deposit_monitor: "Crypto Deposit Monitor",
  block_explorer_lookup: "Block Explorer Lookup",
  rates_tool: "Rates & Quotes",
  knowledge_base: "Knowledge Base",
};

export function toolLabel(key: string): string {
  return TOOL_LABELS[key] ?? key;
}
