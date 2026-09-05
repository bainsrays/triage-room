import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KnowledgeBaseArticle } from "./WorkspacePage";

describe("KnowledgeBaseArticle", () => {
  const article = { title: "Wire matching policy", body: "Request the wire confirmation." };

  it("starts as a native collapsed disclosure with an accessible summary", () => {
    const onOpen = vi.fn();
    const html = renderToStaticMarkup(createElement(KnowledgeBaseArticle, { item: article, onOpen }));
    expect(html).toMatch(/^<details\b/);
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
    expect(html).toMatch(/<summary[^>]*>.*Wire matching policy.*<\/summary>/);
    expect(html).toContain(article.body);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("awards read credit only for opening, not closing", () => {
    const onOpen = vi.fn();
    const disclosure = KnowledgeBaseArticle({ item: article, onOpen }) as ReactElement<{
      onToggle: (event: { currentTarget: { open: boolean } }) => void;
    }>;
    disclosure.props.onToggle({ currentTarget: { open: false } });
    expect(onOpen).not.toHaveBeenCalled();
    disclosure.props.onToggle({ currentTarget: { open: true } });
    expect(onOpen).toHaveBeenCalledTimes(1);
    disclosure.props.onToggle({ currentTarget: { open: false } });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
