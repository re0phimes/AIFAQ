function normalizeCiteGroup(segment: string): string {
  return segment.replace(/(?:\[cite:([^\]]+)\])+/g, (match) => {
    const refs = [...match.matchAll(/\[cite:([^\]]+)\]/g)].map((entry) => entry[1]?.trim()).filter(Boolean);
    if (refs.length === 0) return "";
    return ` (${refs.join("; ")})`;
  });
}

function normalizeMath(segment: string): string {
  return segment
    .replace(/\\\[\s*\n?([\s\S]*?)\n?\s*\\\]/g, (_, expr: string) => `$$\n${expr.trim()}\n$$`)
    .replace(/\\\((.+?)\\\)/g, (_whole, expr: string) => `$${expr.trim()}$`);
}

function transformNonCode(segment: string): string {
  return normalizeMath(normalizeCiteGroup(segment));
}

function transformPreservingInlineCode(segment: string): string {
  const parts = segment.split(/(`[^`]*`)/g);
  return parts
    .map((part) => (part.startsWith("`") && part.endsWith("`") ? part : transformNonCode(part)))
    .join("");
}

export function preprocessMarkdown(content: string): string {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => (part.startsWith("```") && part.endsWith("```") ? part : transformPreservingInlineCode(part)))
    .join("");
}
