import { describe, expect, it } from "vitest";
import ticketsFile from "../content/tickets.json";
import type { Ticket, TicketsFile } from "../types/ticket";
import {
  findBannedPhrases,
  findBvnNumbers,
  findCardNumbers,
  findJargonTerms,
  luhnCheck,
  runComposerChecks,
} from "./composerChecks";

const tickets = (ticketsFile as TicketsFile).tickets;
const ticket2110 = tickets.find((t) => t.id === "INC-2110") as Ticket;
// INC-2103's authored model_reply contains no jargon-list terms, unlike some
// other tickets (e.g. INC-2110's own model_reply legitimately uses ERC-20 /
// BEP-20 / "block explorer" — a content nuance noted in the final report),
// so it's a better fixture for the "clean reply passes everything" case.
const ticket2103 = tickets.find((t) => t.id === "INC-2103") as Ticket;

describe("luhnCheck", () => {
  it("validates a known-good Luhn number", () => {
    expect(luhnCheck("4111111111111111")).toBe(true);
  });
  it("rejects a broken checksum", () => {
    expect(luhnCheck("4111111111111112")).toBe(false);
  });
});

describe("findCardNumbers", () => {
  it("flags a valid test PAN (4111 1111 1111 1111)", () => {
    const found = findCardNumbers("Your card 4111111111111111 was charged twice.");
    expect(found.length).toBe(1);
    expect(found[0].match.replace(/\D/g, "")).toBe("4111111111111111");
  });

  it("flags a spaced/dashed PAN", () => {
    const found = findCardNumbers("Card: 4111-1111-1111-1111 on file.");
    expect(found.length).toBe(1);
  });

  it("does not flag a random 16-digit number that fails Luhn", () => {
    const found = findCardNumbers("Reference number 1234567890123456 was logged.");
    expect(found.length).toBe(0);
  });

  it("does not flag ordinary prose with no long digit runs", () => {
    const found = findCardNumbers("Hi Ifeoma, thanks for reaching out about your transfer.");
    expect(found.length).toBe(0);
  });
});

describe("findBvnNumbers", () => {
  it("flags an 11-digit number", () => {
    const found = findBvnNumbers("Her BVN is 22112345678 on file.");
    expect(found.length).toBe(1);
    expect(found[0].match).toBe("22112345678");
  });

  it("does not flag a 10-digit or 12-digit number", () => {
    expect(findBvnNumbers("Phone ref 2211234567.").length).toBe(0);
    expect(findBvnNumbers("Long ref 221123456789.").length).toBe(0);
  });
});

describe("findBannedPhrases", () => {
  it("flags guarantee language", () => {
    expect(findBannedPhrases("This is 100% safe and guaranteed to work.").length).toBeGreaterThan(0);
  });
  it("does not flag a clean, hedged reply", () => {
    expect(findBannedPhrases("This is likely to resolve within 24 hours.").length).toBe(0);
  });
});

describe("findJargonTerms", () => {
  it("flags internal system jargon", () => {
    const found = findJargonTerms("Your NIBSS NIP transfer returned a processor_response of REVERSAL_INITIATED.");
    expect(found).toEqual(expect.arrayContaining(["NIBSS", "NIP", "processor_response"]));
  });
  it("does not flag a plain-language reply", () => {
    expect(findJargonTerms("Your transfer is safely held and will be reversed within 24 hours.").length).toBe(0);
  });
});

describe("runComposerChecks (integration)", () => {
  it("flags a reply containing a fake card number for a real ticket", () => {
    const results = runComposerChecks(
      "Please confirm the payment card 4111111111111111 that you used for this deposit.",
      ticket2110
    );
    const panCheck = results.find((r) => r.id === "no-full-pan");
    expect(panCheck?.passed).toBe(false);
  });

  it("passes all danger/warning checks for a ticket's own clean model_reply", () => {
    const results = runComposerChecks(ticket2103.model_reply, ticket2103);
    const failing = results.filter((r) => !r.passed && r.severity !== "info");
    expect(failing).toEqual([]);
  });
});
