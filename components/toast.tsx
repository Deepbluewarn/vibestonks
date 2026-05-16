"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  variant: "success" | "error";
  onDismiss: () => void;
  /** Milliseconds. 0 = no auto-dismiss. */
  autoDismissMs?: number;
}

/**
 * 화면 상단 중앙에 떠 있는 알림. 약간 슬라이드 + 페이드인.
 * autoDismissMs 후 자동 닫힘. 클릭해도 닫힘.
 */
export function Toast({
  message,
  variant,
  onDismiss,
  autoDismissMs = 3500,
}: ToastProps) {
  useEffect(() => {
    if (!autoDismissMs) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [message, autoDismissMs, onDismiss]);

  const palette =
    variant === "success"
      ? "border-emerald-300/60 bg-emerald-50/95 text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/80 dark:text-emerald-200"
      : "border-rose-300/60 bg-rose-50/95 text-rose-800 dark:border-rose-700/40 dark:bg-rose-950/80 dark:text-rose-200";

  return (
    <div
      role="status"
      onClick={onDismiss}
      className={`fixed left-1/2 top-4 z-50 max-w-[90vw] -translate-x-1/2 cursor-pointer animate-in fade-in slide-in-from-top-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur duration-200 ${palette}`}
    >
      {message}
    </div>
  );
}
