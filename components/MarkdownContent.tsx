"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { preprocessMarkdown } from "@/lib/markdown-content";

interface MarkdownContentProps {
  content: string;
  className?: string;
  delay?: number; // 延迟渲染时间（毫秒），用于 Modal 等需要即时反馈的场景
}

const customComponents: Components = {
  table: ({ children }) => (
    <div className="table-wrapper max-w-full overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

export default function MarkdownContent({ 
  content, 
  className,
  delay = 0 
}: MarkdownContentProps) {
  const normalizedContent = preprocessMarkdown(content);
  const [readyContent, setReadyContent] = useState<string | null>(delay === 0 ? normalizedContent : null);
  const contentReady = delay === 0 || readyContent === normalizedContent;

  // 延迟渲染内容（用于 Modal 优化）
  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => {
      setReadyContent(normalizedContent);
    }, delay);

    return () => clearTimeout(timer);
  }, [normalizedContent, delay]);

  // delay > 0 时，挂载但未准备好内容显示骨架屏
  if (delay > 0 && !contentReady) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface rounded w-3/4"></div>
          <div className="h-4 bg-surface rounded w-full"></div>
          <div className="h-4 bg-surface rounded w-5/6"></div>
          <div className="h-4 bg-surface rounded w-1/2"></div>
          <div className="h-4 bg-surface rounded w-2/3"></div>
          <div className="h-4 bg-surface rounded w-4/5"></div>
        </div>
      </div>
    );
  }

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
