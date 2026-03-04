"use client";

import { useCallback, useEffect } from "react";

export type ActionDialogKind = "alert" | "confirm";

interface ActionDialogProps {
  isOpen: boolean;
  kind: ActionDialogKind;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ActionDialog({
  isOpen,
  kind,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ActionDialogProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onCancel();
      }
    },
    [isOpen, onCancel]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const finalConfirmText = confirmText ?? (kind === "alert" ? "OK" : "Confirm");
  const finalCancelText = cancelText ?? "Cancel";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} aria-hidden="true" />

      <div
        className="relative w-[min(92vw,28rem)] rounded-2xl border-[0.5px] border-border bg-panel p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            type="button"
            className="rounded-full p-1 text-subtext transition-colors hover:bg-surface hover:text-text"
            onClick={onCancel}
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed text-subtext">{message}</p>

        <div className="mt-4 flex justify-end gap-2">
          {kind === "confirm" && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border-[0.5px] border-border px-3 py-1.5 text-sm text-subtext transition-colors hover:bg-surface"
            >
              {finalCancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary-hover"
          >
            {finalConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
