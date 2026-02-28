"use client";

import { useState, useEffect, useRef, memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface LazyMarkdownContentProps {
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
 * 渐进式渲染 Markdown
 * - 首屏：纯文本预览（瞬间显示）
 * - 后续：异步解析完整 Markdown
 * 避免大段 Markdown 阻塞主线程
 */
function LazyMarkdownContent({ content, className }: LazyMarkdownContentProps) {
  const [isReady, setIsReady] = useState(false);
  const scheduledRef = useRef(false);

  useEffect(() => {
    // 重置状态
    setIsReady(false);
    scheduledRef.current = false;

    // 使用 requestIdleCallback 或 setTimeout 延迟解析
    const scheduleRender = () => {
      if (scheduledRef.current) return;
      scheduledRef.current = true;

      const id = (window as any).requestIdleCallback
        ? (window as any).requestIdleCallback(() => setIsReady(true), { timeout: 100 })
        : setTimeout(() => setIsReady(true), 50);

      return () => {
        if ((window as any).requestIdleCallback) {
          (window as any).cancelIdleCallback(id);
        } else {
          clearTimeout(id);
        }
      };
    };

    return scheduleRender();
  }, [content]);

  // 未准备好时显示简化预览（去除 Markdown 标记的纯文本）
  if (!isReady) {
    // 快速提取纯文本预览（只处理前 2000 字符，避免长内容卡顿）
    const previewText = content
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
          {content.length > 2000 && (
            <p className="text-subtext text-sm">加载更多内容...</p>
          )}
        </div>
      </div>
    );
  }

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

export default memo(LazyMarkdownContent);
