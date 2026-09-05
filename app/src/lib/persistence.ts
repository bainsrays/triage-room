import { SHIFT_STATE_SCHEMA_VERSION, SHIFT_STATE_STORAGE_KEY, emptyShiftState } from "../types/session";
import type { ShiftState } from "../types/session";

type ShiftUpdate = (state: ShiftState) => ShiftState;
let unsavedUpdates: ShiftUpdate[] = [];
let unsavedBase: ShiftState | null = null;

export function loadShiftState(fallback: () => ShiftState = emptyShiftState): ShiftState {
  try {
    const raw = window.localStorage.getItem(SHIFT_STATE_STORAGE_KEY);
    if (!raw) return emptyShiftState();
    const parsed = JSON.parse(raw) as ShiftState;
    if (!parsed || parsed.schemaVersion !== SHIFT_STATE_SCHEMA_VERSION) {
      return emptyShiftState();
    }
    return parsed;
  } catch {
    return fallback();
  }
}

export function saveShiftState(state: ShiftState): boolean {
  try {
    window.localStorage.setItem(SHIFT_STATE_STORAGE_KEY, JSON.stringify(state));
    unsavedUpdates = [];
    unsavedBase = null;
    return true;
  } catch {
    // localStorage may be unavailable (private mode, quota); fail silently —
    // the app still functions for the current session, just without persistence.
    return false;
  }
}

function loadPersistedBase(fallback: () => ShiftState): ShiftState {
  const latest = loadShiftState(() => unsavedBase ?? fallback());
  if (unsavedBase && latest.resetId !== unsavedBase.resetId) {
    unsavedUpdates = [];
    unsavedBase = null;
  }
  return latest;
}

export function loadWorkingShiftState(fallback: () => ShiftState = emptyShiftState): ShiftState {
  const latest = loadPersistedBase(fallback);
  if (unsavedUpdates.length > 0) unsavedBase = latest;
  return unsavedUpdates.reduce((current, update) => update(current), latest);
}

export async function updateShiftState(
  updater: (state: ShiftState) => ShiftState,
  fallback: () => ShiftState
): Promise<ShiftState> {
  let commitStarted = false;
  const commit = () => {
    commitStarted = true;
    const base = loadPersistedBase(fallback);
    const updates = [...unsavedUpdates, updater];
    const next = updates.reduce((current, update) => update(current), base);
    if (!saveShiftState(next)) {
      unsavedBase = base;
      unsavedUpdates = updates;
    }
    return next;
  };
  try {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request(SHIFT_STATE_STORAGE_KEY, commit);
    }
  } catch (error) {
    if (commitStarted) throw error;
  }
  return commit();
}

export function clearShiftState(): void {
  try {
    window.localStorage.removeItem(SHIFT_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
