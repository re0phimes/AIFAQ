"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  action,
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
      <div className="flex items-center gap-4 rounded-lg bg-gray-900/90 px-4 py-3 text-sm text-white shadow-lg">
        <span>{message}</span>
        {action && (
          <button
            onClick={() => {
              action.onClick();
              // 注意：不在这里调用 onClose，让 action handler 自己控制关闭时机
              // 避免状态更新不同步的问题
            }}
            className="font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
