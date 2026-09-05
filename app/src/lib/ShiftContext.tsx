import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  EscalationChoice,
  ShiftState,
  SqlQueryEvent,
  TicketWorkState,
  ToolOpenEvent,
} from "../types/session";
import { emptyShiftState, emptyTicketWorkState, SHIFT_STATE_STORAGE_KEY } from "../types/session";
import { loadShiftState, loadWorkingShiftState, updateShiftState } from "./persistence";
import { scoreTicket } from "../scoring/engine";
import type { Ticket } from "../types/ticket";

interface ShiftContextValue {
  state: ShiftState;
  startShift: () => void;
  resetShift: () => void;
  getTicketWork: (ticketId: string) => TicketWorkState;
  markToolOpened: (ticketId: string, toolKey: string) => void;
  markKbOpened: (ticketId: string) => void;
  recordSqlQuery: (ticketId: string, event: SqlQueryEvent) => void;
  setRootCause: (ticketId: string, index: number) => void;
  setResolution: (ticketId: string, index: number) => void;
  setEscalation: (ticketId: string, escalation: EscalationChoice) => void;
  setReplyDraft: (ticketId: string, draft: string) => void;
  markInProgress: (ticketId: string) => void;
  submitTicket: (ticket: Ticket) => void;
}

const ShiftContext = createContext<ShiftContextValue | null>(null);

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShiftState>(() => loadShiftState());
  const currentState = useRef(state);
  const committedState = useRef(state);
  const pendingUpdates = useRef(0);
  const persistenceQueue = useRef(Promise.resolve());

  const updateState = useCallback((updater: (previous: ShiftState) => ShiftState) => {
    currentState.current = updater(currentState.current);
    setState(currentState.current);
    pendingUpdates.current += 1;
    persistenceQueue.current = persistenceQueue.current.then(() => updateShiftState(updater, () => committedState.current)).then((next) => {
      committedState.current = next;
      pendingUpdates.current -= 1;
      if (pendingUpdates.current === 0) {
        currentState.current = next;
        setState(next);
      }
    });
  }, []);

  useEffect(() => {
    const syncState = (event: StorageEvent) => {
      if (event.key !== SHIFT_STATE_STORAGE_KEY && event.key !== null) return;
      if (event.storageArea !== window.localStorage || pendingUpdates.current > 0) return;
      const latest = loadWorkingShiftState(() => committedState.current);
      committedState.current = latest;
      currentState.current = latest;
      setState(latest);
    };
    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, []);

  const getTicketWork = useCallback(
    (ticketId: string): TicketWorkState => state.tickets[ticketId] ?? emptyTicketWorkState(ticketId),
    [state.tickets]
  );

  const updateTicket = useCallback((ticketId: string, updater: (work: TicketWorkState) => TicketWorkState) => {
    updateState((prev) => {
      const current = prev.tickets[ticketId] ?? emptyTicketWorkState(ticketId);
      const next = updater(current);
      return { ...prev, tickets: { ...prev.tickets, [ticketId]: next } };
    });
  }, [updateState]);

  const startShift = useCallback(() => {
    updateState((prev) => ({ ...prev, shiftStartedAt: prev.shiftStartedAt ?? Date.now() }));
  }, [updateState]);

  const resetShift = useCallback(() => {
    const resetId = crypto.randomUUID();
    updateState(() => ({ ...emptyShiftState(), resetId }));
  }, [updateState]);

  const markToolOpened = useCallback(
    (ticketId: string, toolKey: string) => {
      updateTicket(ticketId, (work) => {
        if (work.toolOpens.some((o: ToolOpenEvent) => o.toolKey === toolKey)) return work;
        return {
          ...work,
          status: work.status === "new" ? "in_progress" : work.status,
          startedAt: work.startedAt ?? Date.now(),
          toolOpens: [...work.toolOpens, { toolKey, openedAt: Date.now() }],
        };
      });
    },
    [updateTicket]
  );

  const markKbOpened = useCallback(
    (ticketId: string) => {
      updateTicket(ticketId, (work) => ({ ...work, knowledgeBaseOpened: true }));
    },
    [updateTicket]
  );

  const recordSqlQuery = useCallback(
    (ticketId: string, event: SqlQueryEvent) => {
      updateTicket(ticketId, (work) => ({ ...work, sqlQueries: [...work.sqlQueries, event] }));
    },
    [updateTicket]
  );

  const setRootCause = useCallback(
    (ticketId: string, index: number) => {
      updateTicket(ticketId, (work) => ({ ...work, selectedRootCauseIndex: index }));
    },
    [updateTicket]
  );

  const setResolution = useCallback(
    (ticketId: string, index: number) => {
      updateTicket(ticketId, (work) => ({ ...work, selectedResolutionIndex: index }));
    },
    [updateTicket]
  );

  const setEscalation = useCallback(
    (ticketId: string, escalation: EscalationChoice) => {
      updateTicket(ticketId, (work) => ({ ...work, escalation }));
    },
    [updateTicket]
  );

  const setReplyDraft = useCallback(
    (ticketId: string, draft: string) => {
      updateTicket(ticketId, (work) => ({ ...work, replyDraft: draft }));
    },
    [updateTicket]
  );

  const markInProgress = useCallback(
    (ticketId: string) => {
      updateTicket(ticketId, (work) => ({
        ...work,
        status: work.status === "new" ? "in_progress" : work.status,
        startedAt: work.startedAt ?? Date.now(),
      }));
    },
    [updateTicket]
  );

  const submitTicket = useCallback(
    (ticket: Ticket) => {
      updateState((prev) => {
        const current = prev.tickets[ticket.id] ?? emptyTicketWorkState(ticket.id);
        const submitted: TicketWorkState = { ...current, status: "resolved", submittedAt: Date.now() };
        const score = scoreTicket(ticket, submitted);
        return {
          ...prev,
          tickets: { ...prev.tickets, [ticket.id]: submitted },
          scores: { ...prev.scores, [ticket.id]: score },
        };
      });
    },
    [updateState]
  );

  const value = useMemo<ShiftContextValue>(
    () => ({
      state,
      startShift,
      resetShift,
      getTicketWork,
      markToolOpened,
      markKbOpened,
      recordSqlQuery,
      setRootCause,
      setResolution,
      setEscalation,
      setReplyDraft,
      markInProgress,
      submitTicket,
    }),
    [
      state,
      startShift,
      resetShift,
      getTicketWork,
      markToolOpened,
      markKbOpened,
      recordSqlQuery,
      setRootCause,
      setResolution,
      setEscalation,
      setReplyDraft,
      markInProgress,
      submitTicket,
    ]
  );

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift(): ShiftContextValue {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be used within a ShiftProvider");
  return ctx;
}
