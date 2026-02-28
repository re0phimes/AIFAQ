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
  const [renderedContent, setRenderedContent] = useState<React.ReactNode>(null);
  const [isLoading, setIsLoading] = useState(true);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
    setIsLoading(true);
    setRenderedContent(null);

    let cancelled = false;

    // 使用 requestIdleCallback 延迟到浏览器空闲时执行
    const scheduleRender = () => {
      const idleCallback = (window as any).requestIdleCallback;
      
      const render = () => {
        if (cancelled) return;
        
        // 分段渲染：先显示纯文本，再异步渲染 Markdown
        setRenderedContent(
          <ReactMarkdown
            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
            rehypePlugins={[rehypeKatex]}
            components={customComponents}
          >
            {contentRef.current}
          </ReactMarkdown>
        );
        setIsLoading(false);
      };

      if (idleCallback) {
        return idleCallback(render, { timeout: 200 });
      } else {
        return setTimeout(render, 0);
      }
    };

    const id = scheduleRender();

    return () => {
      cancelled = true;
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
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

  return <div className={className}>{renderedContent}</div>;
}

export default memo(AsyncMarkdownContent);
