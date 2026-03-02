"use client";

import { useCallback, useEffect, useState } from "react";

interface ToastProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, action, onClose, duration = 5000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // Wait for exit animation before calling onClose
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto close after duration
    const closeTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, handleClose]);

  const handleAction = () => {
    // Don't auto-call onClose here - let the action handler decide
    // This prevents race conditions where onClose might remove the item
    // before the undo action completes
    if (action) {
      action.onClick();
    }
  };

  return (
    <div
      className={`
        fixed bottom-4 left-1/2 z-50 -translate-x-1/2
        flex items-center gap-3 rounded-full
        bg-surface px-4 py-3 shadow-lg
        border border-border
        transition-all duration-200 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
      `}
    >
      <span className="text-sm text-text">{message}</span>
      {action && (
        <button
          onClick={handleAction}
          className="rounded-full px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        className="ml-1 text-subtext hover:text-text transition-colors"
        aria-label="Close"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
