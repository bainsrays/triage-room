import type { ReactNode } from "react";
import rubricMd from "../content/rubric.md?raw";

// Minimal markdown-to-React renderer for the rubric — deliberately not pulling
// in a markdown library for one static document. Handles the small subset of
// markdown rubric.md actually uses: #/##/### headings, bold, numbered lists,
// bullet lists, and plain paragraphs.
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listOrdered = false;

  function flushList() {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />);
    blocks.push(
      listOrdered ? (
        <ol key={`ol-${blocks.length}`} className="ml-5 list-decimal space-y-1.5 text-[14px] leading-relaxed text-ink-2">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="ml-5 list-disc space-y-1.5 text-[14px] leading-relaxed text-ink-2">
          {items}
        </ul>
      )
    );
    listBuffer = [];
  }

  function inline(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em]">$1</code>');
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="mt-6 text-[16px] font-semibold text-ink">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2 key={blocks.length} className="mt-8 text-[20px] font-semibold tracking-tight text-ink">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushList();
      blocks.push(
        <h1 key={blocks.length} className="text-[26px] font-semibold tracking-tight text-ink">
          {line.slice(2)}
        </h1>
      );
    } else if (/^-\s+/.test(line)) {
      if (listOrdered) flushList();
      listOrdered = false;
      listBuffer.push(line.replace(/^-\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      if (!listOrdered) flushList();
      listOrdered = true;
      listBuffer.push(line.replace(/^\d+\.\s+/, ""));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p key={blocks.length} className="text-[14px] leading-relaxed text-ink-2" dangerouslySetInnerHTML={{ __html: inline(line) }} />
      );
    }
  }
  flushList();
  return blocks;
}

export default function HowScoringWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="grid gap-3">{renderMarkdown(rubricMd)}</div>
    </div>
  );
}
