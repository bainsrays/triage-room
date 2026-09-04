import { useEffect, useState } from "react";
import { toolLabel } from "../lib/tickets";
import ToolPanel from "./ToolPanel";

export default function ToolTabs({
  tools,
  onOpenTool,
}: {
  tools: Record<string, unknown>;
  onOpenTool: (toolKey: string) => void;
}) {
  const keys = Object.keys(tools);
  const [active, setActive] = useState(keys[0]);
  const [opened, setOpened] = useState<Set<string>>(new Set(keys[0] ? [keys[0]] : []));

  function selectTab(key: string) {
    setActive(key);
    if (!opened.has(key)) {
      setOpened((prev) => new Set(prev).add(key));
      onOpenTool(key);
    }
  }

  // Log the initial tab's open too, once, on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (keys[0]) onOpenTool(keys[0]);
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5 border-b border-line pb-0" role="tablist" aria-label="Ticket tools">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => selectTab(key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-t-md border-b-2 px-3 text-[12.5px] font-medium transition-colors ${
              active === key ? "border-accent text-accent-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {toolLabel(key)}
            {opened.has(key) && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" title="opened" />
            )}
          </button>
        ))}
      </div>

      <label htmlFor="tool-select-mobile" className="sr-only">
        Select a tool
      </label>
      <select
        id="tool-select-mobile"
        value={active}
        onChange={(e) => selectTab(e.target.value)}
        className="mb-3 hidden h-9 w-full rounded-md border border-line bg-surface px-2 text-[13px] max-[520px]:block"
      >
        {keys.map((key) => (
          <option key={key} value={key}>
            {toolLabel(key)}
          </option>
        ))}
      </select>

      <div role="tabpanel" className="rounded-lg border border-line bg-surface p-4">
        <ToolPanel toolKey={active} data={tools[active]} />
      </div>
    </div>
  );
}
