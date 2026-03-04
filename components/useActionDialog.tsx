"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ActionDialog, { type ActionDialogKind } from "./ActionDialog";

interface ShowActionDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogState {
  kind: ActionDialogKind;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

type PendingResolver = ((accepted: boolean) => void) | null;

export function useActionDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolverRef = useRef<PendingResolver>(null);

  const resolvePending = useCallback((accepted: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) resolver(accepted);
  }, []);

  useEffect(() => {
    return () => {
      resolvePending(false);
    };
  }, [resolvePending]);

  const showAlert = useCallback((options: ShowActionDialogOptions): Promise<void> => {
    resolvePending(false);
    setDialog({
      kind: "alert",
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
    });
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
    });
  }, [resolvePending]);

  const showConfirm = useCallback((options: ShowActionDialogOptions): Promise<boolean> => {
    resolvePending(false);
    setDialog({
      kind: "confirm",
      title: options.title,
      message: options.message,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
    });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [resolvePending]);

  const handleConfirm = useCallback(() => {
    setDialog(null);
    resolvePending(true);
  }, [resolvePending]);

  const handleCancel = useCallback(() => {
    setDialog(null);
    resolvePending(false);
  }, [resolvePending]);

  const dialogNode = useMemo(() => {
    if (!dialog) return null;
    return (
      <ActionDialog
        isOpen={!!dialog}
        kind={dialog.kind}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [dialog, handleCancel, handleConfirm]);

  return { showAlert, showConfirm, dialogNode };
}
