"use client";

import { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface AsyncMarkdownContentProps {
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
 * 异步 Markdown 渲染 - 使用 Web Worker 或 requestIdleCallback
 * 避免阻塞主线程
 */
function AsyncMarkdownContent({ content, className }: AsyncMarkdownContentProps) {
  const [rendered, setRendered] = useState<{ source: string; node: React.ReactNode } | null>(null);
  const contentRef = useRef(content);
  const isLoading = rendered?.source !== content;

  useEffect(() => {
    contentRef.current = content;

    let cancelled = false;

    // 使用 requestIdleCallback 延迟到浏览器空闲时执行
    const render = () => {
      if (cancelled) return;
      const source = contentRef.current;
      // 分段渲染：先显示纯文本，再异步渲染 Markdown
      setRendered({
        source,
        node: (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
            rehypePlugins={[rehypeKatex]}
            components={customComponents}
          >
            {source}
          </ReactMarkdown>
        ),
      });
    };

    const scheduleRender = () => {
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(render, { timeout: 200 });
        return () => window.cancelIdleCallback?.(id);
      }
      const id = window.setTimeout(render, 0);
      return () => window.clearTimeout(id);
    };

    const cancelScheduledRender = scheduleRender();

    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [content]);

  // 加载状态：显示简单的骨架屏，不做复杂处理
  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-surface animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-surface animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  return <div className={className}>{rendered?.node}</div>;
}

export default memo(AsyncMarkdownContent);
