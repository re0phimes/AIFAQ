"use client";

import { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { preprocessMarkdown } from "@/lib/markdown-content";

interface LazyMarkdownContentProps {
  content: string;
  className?: string;
}

const customComponents: Components = {
  table: ({ children }) => (
    <div className="table-wrapper max-w-full overflow-x-auto">
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
 * 渐进式渲染 Markdown
 * - 首屏：纯文本预览（瞬间显示）
 * - 后续：异步解析完整 Markdown
 * 避免大段 Markdown 阻塞主线程
 */
function LazyMarkdownContent({ content, className }: LazyMarkdownContentProps) {
  const normalizedContent = preprocessMarkdown(content);
  const [readyContent, setReadyContent] = useState<string | null>(null);
  const scheduledRef = useRef(false);
  const isReady = readyContent === normalizedContent;

  useEffect(() => {
    scheduledRef.current = false;

    // 使用 requestIdleCallback 或 setTimeout 延迟解析
    const scheduleRender = () => {
      if (scheduledRef.current) return;
      scheduledRef.current = true;

      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(() => setReadyContent(normalizedContent), { timeout: 100 });
        return () => window.cancelIdleCallback?.(id);
      }

      const id = window.setTimeout(() => setReadyContent(normalizedContent), 50);
      return () => window.clearTimeout(id);
    };

    return scheduleRender();
  }, [normalizedContent]);

  // 未准备好时显示简化预览（去除 Markdown 标记的纯文本）
  if (!isReady) {
    // 快速提取纯文本预览（只处理前 2000 字符，避免长内容卡顿）
    const previewText = normalizedContent
      .slice(0, 2000)
      .replace(/[#*_`\[\](){}|]/g, "")  // 移除常见 Markdown 标记
      .replace(/\$[^$]+\$/g, "[公式]")   // 数学公式占位
      .replace(/\n{2,}/g, "\n\n");       // 压缩空行

    return (
      <div className={className}>
        <div className="animate-pulse">
          {previewText.split('\n').map((line, i) => (
            <p key={i} className="mb-2 text-text/70">{line || ' '}</p>
          ))}
          {normalizedContent.length > 2000 && (
            <p className="text-subtext text-sm">加载更多内容...</p>
          )}
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

export default memo(LazyMarkdownContent);
