"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface SyncMarkdownContentProps {
  content: string;
  className?: string;
}

const customComponents: Components = {
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-surface px-3 py-2 text-left font-medium text-text">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 text-text align-top">
      {children}
    </td>
  ),
};

/**
 * 同步渲染 Markdown，无骨架屏，无延迟
 * 仅在 Modal 等客户端动态打开的场景使用
 */
function SyncMarkdownContent({
  content,
  className
}: SyncMarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[rehypeKatex]}
        components={customComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(SyncMarkdownContent);
