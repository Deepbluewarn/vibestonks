"use client";

import { useEffect, useState } from "react";

interface Props {
  roundId: number;
  startedAtMs: number;
}

/**
 * 헤더 부제: "Round N · 시작한 지 X · 팔기 전엔 내 돈이 아니다"
 * 클라이언트에서 30초마다 경과 시간 갱신.
 */
export function RoundStatus({ roundId, startedAtMs }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const elapsed = formatElapsed(now - startedAtMs);

  return (
    <p className="text-sm text-gray-500 dark:text-gray-400" suppressHydrationWarning>
      Round {roundId} · 시작한 지 {elapsed} · 팔기 전엔 내 돈이 아니다
    </p>
  );
}

function formatElapsed(ms: number): string {
  if (ms < 60_000) return "방금";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간`;
  const d = Math.floor(h / 24);
  return `${d}일`;
}
