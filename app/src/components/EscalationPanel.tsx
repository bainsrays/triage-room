import { useState } from "react";
import type { EscalationChoice } from "../types/session";

const TEAM_OPTIONS = ["Payments Ops", "Compliance", "Crypto Ops", "Treasury Ops", "Engineering"];
const PAYLOAD_ITEMS = ["Transaction reference", "Tx hash / block explorer link", "Timeline of events", "Customer evidence (screenshot, doc)", "Network / rail name"];

export default function EscalationPanel({
  value,
  onChange,
  disabled,
}: {
  value: EscalationChoice | null;
  onChange: (v: EscalationChoice) => void;
  disabled?: boolean;
}) {
  const [didEscalate, setDidEscalate] = useState(value?.didEscalate ?? false);
  const [routedTo, setRoutedTo] = useState(value?.routedTo ?? "");
  const [payloadItems, setPayloadItems] = useState<string[]>(value?.payloadItems ?? []);

  function commit(next: Partial<EscalationChoice>) {
    const merged: EscalationChoice = {
      didEscalate: next.didEscalate ?? didEscalate,
      routedTo: next.routedTo ?? routedTo,
      payloadItems: next.payloadItems ?? payloadItems,
      chosenAt: Date.now(),
    };
    onChange(merged);
  }

  return (
    <fieldset disabled={disabled} className="grid gap-3">
      <legend className="text-[13px] font-medium text-ink">Escalation decision</legend>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={didEscalate}
          onClick={() => {
            setDidEscalate(true);
            commit({ didEscalate: true });
          }}
          className={`btn ${didEscalate ? "btn-primary" : ""}`}
        >
          Escalate this ticket
        </button>
        <button
          type="button"
          aria-pressed={!didEscalate}
          onClick={() => {
            setDidEscalate(false);
            setRoutedTo("");
            setPayloadItems([]);
            commit({ didEscalate: false, routedTo: null, payloadItems: [] });
          }}
          className={`btn ${!didEscalate ? "btn-primary" : ""}`}
        >
          Resolve without escalating
        </button>
      </div>

      {didEscalate && (
        <div className="grid gap-3 rounded-lg border border-line bg-surface-sunken/50 p-3">
          <div className="grid gap-1.5">
            <label htmlFor="escalation-team" className="text-[12.5px] font-medium text-ink">
              Route to team
            </label>
            <select
              id="escalation-team"
              value={routedTo ?? ""}
              onChange={(e) => {
                setRoutedTo(e.target.value);
                commit({ routedTo: e.target.value });
              }}
              className="h-9 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus:border-accent"
            >
              <option value="">Select a team…</option>
              {TEAM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-ink">Attach to the escalation</span>
            <div className="grid gap-1.5">
              {PAYLOAD_ITEMS.map((item) => {
                const checked = payloadItems.includes(item);
                return (
                  <label key={item} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked ? [...payloadItems, item] : payloadItems.filter((p) => p !== item);
                        setPayloadItems(next);
                        commit({ payloadItems: next });
                      }}
                      className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                    />
                    {item}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
