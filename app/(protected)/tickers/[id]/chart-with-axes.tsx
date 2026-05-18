"use client";

import { useMemo, useState } from "react";
import type { PricePoint } from "@/lib/queries";
import { Sparkline } from "@/app/(protected)/dashboard/sparkline";

type Range = "1d" | "1w" | "1m" | "1y" | "all";
type AxisMode = "time" | "index";

const RANGES: { key: Range; label: string; ms: number | null }[] = [
  { key: "1d", label: "1일", ms: 24 * 60 * 60 * 1000 },
  { key: "1w", label: "1주", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "1m", label: "1월", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "1y", label: "1년", ms: 365 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "전체", ms: null },
];

export function ChartWithAxes({ history }: { history: PricePoint[] }) {
  const [range, setRange] = useState<Range>("all");
  const [axisMode, setAxisMode] = useState<AxisMode>("time");

  const filtered = useMemo(
    () => filterByRange(history, range),
    [history, range],
  );

  // 거래순 모드: 각 포인트에 displayT = index 부여. Sparkline이 displayT 우선 사용.
  const displayPoints = useMemo(() => {
    if (axisMode === "time") return filtered;
    return filtered.map((p, i) => ({ ...p, displayT: i }));
  }, [filtered, axisMode]);

  const view = useMemo(() => {
    if (filtered.length < 2) return null;
    const prices = filtered.map((p) => p.price);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const tMin = filtered[0].t;
    const tMax = filtered[filtered.length - 1].t;
    return { priceMin, priceMax, tMin, tMax };
  }, [filtered]);

  // 하단 시간 라벨
  const ticks = useMemo(() => {
    if (!view) return [] as number[];
    if (axisMode === "index") {
      // 거래순 모드: 시작/끝 두 시각만
      return view.tMin === view.tMax ? [view.tMin] : [view.tMin, view.tMax];
    }
    const N = 5;
    return Array.from({ length: N }, (_, i) =>
      Math.round(view.tMin + ((view.tMax - view.tMin) * i) / (N - 1)),
    );
  }, [view, axisMode]);

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="가격 차트 기간">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white dark:bg-indigo-500"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </nav>

        <span className="hidden h-4 w-px bg-gray-300 dark:bg-gray-700 sm:inline-block" />

        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="가격 차트 X축"
        >
          {(
            [
              { key: "time" as const, label: "시간순" },
              { key: "index" as const, label: "거래순" },
            ]
          ).map((m) => {
            const active = m.key === axisMode;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAxisMode(m.key)}
                title={
                  m.key === "time"
                    ? "시간 흐름대로 (무거래 구간은 평평하게 표시)"
                    : "거래 순서대로 (무거래 구간 압축, 시간은 호버로 확인)"
                }
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div className="h-48 w-full">
          <Sparkline
            points={displayPoints}
            width={800}
            height={192}
            className="h-full w-full"
            interactive
          />
        </div>
        {view && (
          <>
            <span className="absolute right-2 top-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {view.priceMax}pt
            </span>
            {view.priceMin !== view.priceMax && (
              <span className="absolute right-2 bottom-1 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                {view.priceMin}pt
              </span>
            )}
          </>
        )}
      </div>

      {view && ticks.length > 0 && (
        <div className="flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {ticks.map((ts, i) => (
            <span key={i}>{formatTimeShort(ts, view.tMin, view.tMax)}</span>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 선택된 range 범위로 history를 자름.
 * - "all": 원본 그대로 (이미 getPriceHistory에서 활동 기준 auto-trim 됨)
 * - 그 외: [now - rangeMs, now] 윈도우. range 시작 직전의 마지막 가격을 anchor로 박아서
 *   라인이 윈도우 진입 시점부터 정확한 가격에서 시작하게 함.
 */
function filterByRange(history: PricePoint[], range: Range): PricePoint[] {
  const r = RANGES.find((x) => x.key === range);
  if (!r || r.ms === null) return history;

  const now = Date.now();
  const startT = now - r.ms;

  let anchorPrice = 100;
  for (const p of history) {
    if (p.t <= startT) anchorPrice = p.price;
    else break;
  }
  const inRange = history.filter((p) => p.t > startT && p.t <= now && p.side);

  const series: PricePoint[] = [{ t: startT, price: anchorPrice }];
  series.push(...inRange);
  const last = series[series.length - 1];
  if (last.t < now) series.push({ t: now, price: last.price });
  return series;
}

function formatTimeShort(ts: number, rangeStart: number, rangeEnd: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDayRange =
    new Date(rangeStart).toDateString() === new Date(rangeEnd).toDateString();
  const isToday = d.toDateString() === today.toDateString();
  const spanMs = rangeEnd - rangeStart;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const M = d.getMonth() + 1;
  const D = d.getDate();

  // 차트 범위가 오늘 안에서만 끝나면 시:분만, 아니면 날짜도 같이.
  if (sameDayRange && isToday) return `${hh}:${mm}`;
  if (spanMs < 30 * 24 * 60 * 60 * 1000) return `${M}/${D} ${hh}:${mm}`;
  return `${d.getFullYear()}/${M}/${D}`;
}
