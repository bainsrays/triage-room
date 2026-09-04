import { SHIFT_STATE_SCHEMA_VERSION, SHIFT_STATE_STORAGE_KEY, emptyShiftState } from "../types/session";
import type { ShiftState } from "../types/session";

export function loadShiftState(): ShiftState {
  try {
    const raw = window.localStorage.getItem(SHIFT_STATE_STORAGE_KEY);
    if (!raw) return emptyShiftState();
    const parsed = JSON.parse(raw) as ShiftState;
    if (!parsed || parsed.schemaVersion !== SHIFT_STATE_SCHEMA_VERSION) {
      return emptyShiftState();
    }
    return parsed;
  } catch {
    return emptyShiftState();
  }
}

export function saveShiftState(state: ShiftState): void {
  try {
    window.localStorage.setItem(SHIFT_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private mode, quota); fail silently —
    // the app still functions for the current session, just without persistence.
  }
}

export function clearShiftState(): void {
  try {
    window.localStorage.removeItem(SHIFT_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
