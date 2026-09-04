interface Option {
  text: string;
  correct?: boolean;
  quality?: "best" | "acceptable_but_risky" | "wrong";
}

export default function ChoicePicker({
  legend,
  name,
  options,
  selectedIndex,
  onSelect,
  disabled,
  revealed,
}: {
  legend: string;
  name: string;
  options: Option[];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  disabled?: boolean;
  revealed: boolean;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-[13px] font-medium text-ink">{legend}</legend>
      {options.map((opt, i) => {
        const isSelected = selectedIndex === i;
        const isCorrect = opt.correct === true || opt.quality === "best";
        let stateClasses = "border-line bg-surface hover:border-line-strong";
        if (isSelected && !revealed) stateClasses = "border-accent bg-accent-tint";
        if (revealed && isSelected && isCorrect) stateClasses = "border-success-line bg-success-tint";
        if (revealed && isSelected && !isCorrect) stateClasses = "border-danger-line bg-danger-tint";
        if (revealed && !isSelected && isCorrect) stateClasses = "border-success-line bg-success-tint/40";

        return (
          <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-[13px] transition-colors ${stateClasses} ${disabled ? "cursor-not-allowed opacity-90" : ""}`}>
            <input
              type="radio"
              name={name}
              disabled={disabled}
              checked={isSelected}
              onChange={() => onSelect(i)}
              className="mt-0.5 h-4 w-4 flex-none text-accent focus:ring-accent"
            />
            <span className="flex-1 text-ink-2">
              <span className="text-ink">{opt.text}</span>
              {revealed && opt.quality && (
                <span className="ml-2 inline-block rounded-full border border-line px-1.5 py-0.5 align-middle font-mono text-[10px] uppercase text-muted">
                  {opt.quality.replace(/_/g, " ")}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
