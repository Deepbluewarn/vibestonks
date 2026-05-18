"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "connecting" | "open" | "closed";

export function LiveUpdater() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // 이벤트 폭주 시 부하 방지: trailing-edge throttle.
    // 마지막 refresh 후 REFRESH_INTERVAL_MS 안에 들어온 이벤트는 묶어서 한 번만 refresh.
    const REFRESH_INTERVAL_MS = 750;
    let lastRefreshAt = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      const now = Date.now();
      const wait = Math.max(0, lastRefreshAt + REFRESH_INTERVAL_MS - now);
      if (pendingTimer) return; // 이미 예약됨
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        lastRefreshAt = Date.now();
        router.refresh();
      }, wait);
    };

    const connect = () => {
      setStatus("connecting");
      es = new EventSource("/api/stream");

      es.onopen = () => {
        if (!cancelled) setStatus("open");
      };

      es.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as { type: string };
          if (
            evt.type === "trade" ||
            evt.type === "liquidation" ||
            evt.type === "reset"
          ) {
            scheduleRefresh();
          }
        } catch {
          // hello/heartbeat 등 무시
        }
      };

      es.onerror = () => {
        if (!cancelled) setStatus("closed");
        es?.close();
        if (!cancelled) {
          retryTimer = setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pendingTimer) clearTimeout(pendingTimer);
      es?.close();
    };
  }, [router]);

  const color =
    status === "open"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-400"
        : "bg-gray-400 dark:bg-gray-600";
  const label =
    status === "open" ? "LIVE" : status === "connecting" ? "연결 중" : "오프라인";

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/85 dark:text-gray-300">
      <span className="relative inline-flex h-2 w-2">
        {status === "open" && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      {label}
    </div>
  );
}
