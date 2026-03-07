"use client";

import React from "react";

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders plain text with auto-detected URLs and markdown-style [text](url)
 * links converted to clickable <a> tags.
 *
 * Supports two link formats:
 * 1. Markdown links: [link text](https://example.com)
 * 2. Bare URLs: https://example.com or http://example.com
 */
export function LinkifiedText({ text, className }: LinkifiedTextProps) {
  const parts = parseLinks(text);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            {part.label}
          </a>
        ) : (
          <React.Fragment key={i}>{part.text}</React.Fragment>
        )
      )}
    </span>
  );
}

type TextPart =
  | { type: "text"; text: string }
  | { type: "link"; url: string; label: string };

function parseLinks(text: string): TextPart[] {
  // Combined regex: markdown links OR bare URLs
  // Markdown: [text](url)
  // Bare URL: https://... or http://...
  const pattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>\])"]+)/g;
  const parts: TextPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1] && match[2]) {
      // Markdown link: [text](url)
      parts.push({ type: "link", url: match[2], label: match[1] });
    } else if (match[3]) {
      // Bare URL
      parts.push({ type: "link", url: match[3], label: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}
