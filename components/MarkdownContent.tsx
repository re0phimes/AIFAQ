"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface MarkdownContentProps {
  content: string;
  className?: string;
  delay?: number; // 延迟渲染时间（毫秒），用于 Modal 等需要即时反馈的场景
}

const customComponents: Components = {
  table: ({ children }) => (
    <div className="table-wrapper overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

export default function MarkdownContent({ 
  content, 
  className,
  delay = 0 
}: MarkdownContentProps) {
  const [mounted, setMounted] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 延迟渲染内容（用于 Modal 优化）
  useEffect(() => {
    if (!mounted) return;
    if (delay === 0) {
      setContentReady(true);
      return;
    }
    
    const timer = setTimeout(() => {
      setContentReady(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [mounted, delay]);

  // 未挂载时显示骨架屏
  if (!mounted) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface rounded w-3/4"></div>
          <div className="h-4 bg-surface rounded w-full"></div>
          <div className="h-4 bg-surface rounded w-5/6"></div>
          <div className="h-4 bg-surface rounded w-1/2"></div>
        </div>
      </div>
    );
  }

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
        {content}
      </ReactMarkdown>
    </div>
  );
}
