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
            router.refresh();
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
