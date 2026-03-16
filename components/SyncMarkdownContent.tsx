"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { preprocessMarkdown } from "@/lib/markdown-content";

interface SyncMarkdownContentProps {
  content: string;
  className?: string;
}

const customComponents: Components = {
  table: ({ children }) => (
    <div className="table-wrapper overflow-x-auto">
      <table>{children}</table>
    </div>
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
  const normalizedContent = preprocessMarkdown(content);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[rehypeKatex]}
        components={customComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}

export default memo(SyncMarkdownContent);
