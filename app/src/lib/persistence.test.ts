import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyShiftState, emptyTicketWorkState, SHIFT_STATE_STORAGE_KEY } from "../types/session";
import { clearShiftState, loadShiftState, loadWorkingShiftState, saveShiftState, updateShiftState } from "./persistence";

describe("cross-tab shift persistence", () => {
  beforeEach(() => {
    const entries = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    } });
    saveShiftState(emptyShiftState());
    let queue = Promise.resolve();
    vi.stubGlobal("navigator", { locks: {
      request: (_name: string, callback: () => unknown) => {
        const next = queue.then(callback);
        queue = next.then(() => undefined);
        return next;
      },
    } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps edits from two tabs sharing an initially empty snapshot", async () => {
    const stale = emptyShiftState();
    await Promise.all(["INC-2101", "INC-2102"].map((ticketId) =>
      updateShiftState((current) => ({
        ...current,
        tickets: { ...current.tickets, [ticketId]: { ...emptyTicketWorkState(ticketId), replyDraft: ticketId } },
      }), () => stale)
    ));
    expect(loadShiftState().tickets["INC-2101"].replyDraft).toBe("INC-2101");
    expect(loadShiftState().tickets["INC-2102"].replyDraft).toBe("INC-2102");
  });

  it("updates different fields of the same ticket from the latest saved work", async () => {
    const initial = emptyShiftState();
    initial.tickets["INC-2101"] = emptyTicketWorkState("INC-2101");
    saveShiftState(initial);
    await updateShiftState((current) => ({ ...current, tickets: {
      ...current.tickets, "INC-2101": { ...current.tickets["INC-2101"], replyDraft: "Keep this draft" },
    } }), () => initial);
    await updateShiftState((current) => ({ ...current, tickets: {
      ...current.tickets, "INC-2101": { ...current.tickets["INC-2101"], knowledgeBaseOpened: true },
    } }), () => initial);
    expect(loadShiftState().tickets["INC-2101"]).toMatchObject({ replyDraft: "Keep this draft", knowledgeBaseOpened: true });
  });

  it("does not resurrect stale drafts after another tab resets", async () => {
    const stale = emptyShiftState();
    stale.tickets["INC-2101"] = { ...emptyTicketWorkState("INC-2101"), replyDraft: "Old shift" };
    saveShiftState(stale);
    clearShiftState();
    await updateShiftState((current) => ({ ...current, shiftStartedAt: 123 }), () => stale);
    expect(loadShiftState()).toMatchObject({ shiftStartedAt: 123, tickets: {}, scores: {} });
  });

  it("keeps functioning in memory when storage is unavailable", async () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Unavailable"); } });
    const local = emptyShiftState();
    local.shiftStartedAt = 123;
    const result = await updateShiftState((current) => ({ ...current, tickets: {
      "INC-2101": emptyTicketWorkState("INC-2101"),
    } }), () => local);
    expect(result.shiftStartedAt).toBe(123);
    expect(result.tickets["INC-2101"]).toBeDefined();
  });

  it("reads existing v1 saves and tolerates malformed data", () => {
    const existing = emptyShiftState();
    existing.shiftStartedAt = 321;
    saveShiftState(existing);
    expect(loadShiftState()).toEqual(existing);
    window.localStorage.setItem(SHIFT_STATE_STORAGE_KEY, "not json");
    expect(loadShiftState()).toEqual(emptyShiftState());
  });

  it("reads latest storage when Web Locks are unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const current = emptyShiftState();
    current.shiftStartedAt = 456;
    saveShiftState(current);
    const result = await updateShiftState((latest) => latest, emptyShiftState);
    expect(result.shiftStartedAt).toBe(456);
  });

  it("falls back to persistence when the browser denies Web Locks", async () => {
    vi.stubGlobal("navigator", { locks: { request: () => Promise.reject(new Error("Access denied")) } });
    const result = await updateShiftState((current) => ({ ...current, shiftStartedAt: 789 }), emptyShiftState);
    expect(result.shiftStartedAt).toBe(789);
    expect(loadShiftState().shiftStartedAt).toBe(789);
  });

  it("retains memory-only work across repeated quota failures", async () => {
    window.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    const first = await updateShiftState((current) => ({ ...current, shiftStartedAt: 123 }), emptyShiftState);
    const second = await updateShiftState((current) => ({ ...current, tickets: {
      "INC-2101": emptyTicketWorkState("INC-2101"),
    } }), () => first);
    expect(second.shiftStartedAt).toBe(123);
    expect(second.tickets["INC-2101"]).toBeDefined();
  });

  it("rebases unsaved work over remote writes and preserves both when storage recovers", async () => {
    const write = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    await updateShiftState((current) => ({ ...current, tickets: {
      ...current.tickets, "INC-2101": { ...emptyTicketWorkState("INC-2101"), replyDraft: "Unsaved A" },
    } }), emptyShiftState);
    const remote = emptyShiftState();
    remote.tickets["INC-2102"] = { ...emptyTicketWorkState("INC-2102"), replyDraft: "Saved B" };
    write(SHIFT_STATE_STORAGE_KEY, JSON.stringify(remote));
    expect(loadWorkingShiftState().tickets["INC-2101"].replyDraft).toBe("Unsaved A");
    expect(loadWorkingShiftState().tickets["INC-2102"].replyDraft).toBe("Saved B");
    window.localStorage.setItem = write;
    await updateShiftState((current) => current, emptyShiftState);
    expect(loadShiftState().tickets["INC-2101"].replyDraft).toBe("Unsaved A");
    expect(loadShiftState().tickets["INC-2102"].replyDraft).toBe("Saved B");
  });

  it("discards unsaved old-shift operations after a remote reset", async () => {
    const write = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    await updateShiftState((current) => ({ ...current, tickets: {
      "INC-2101": { ...emptyTicketWorkState("INC-2101"), replyDraft: "Old unsaved draft" },
    } }), emptyShiftState);
    write(SHIFT_STATE_STORAGE_KEY, JSON.stringify({ ...emptyShiftState(), resetId: "new-shift" }));
    expect(loadWorkingShiftState().tickets).toEqual({});
  });
});
