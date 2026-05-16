"use client";

import { useMemo, useState } from "react";
import type { PricePoint } from "@/lib/queries";
import { Sparkline } from "@/app/(protected)/dashboard/sparkline";

type Range = "1d" | "1w" | "1m" | "1y" | "all";

const RANGES: { key: Range; label: string; ms: number | null }[] = [
  { key: "1d", label: "1일", ms: 24 * 60 * 60 * 1000 },
  { key: "1w", label: "1주", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "1m", label: "1월", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "1y", label: "1년", ms: 365 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "전체", ms: null },
];

export function ChartWithAxes({ history }: { history: PricePoint[] }) {
  const [range, setRange] = useState<Range>("all");

  const filtered = useMemo(
    () => filterByRange(history, range),
    [history, range],
  );

  const view = useMemo(() => {
    if (filtered.length < 2) return null;
    const prices = filtered.map((p) => p.price);
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const tMin = filtered[0].t;
    const tMax = filtered[filtered.length - 1].t;
    const tickCount = 5;
    const timeTicks = Array.from({ length: tickCount }, (_, i) =>
      Math.round(tMin + ((tMax - tMin) * i) / (tickCount - 1)),
    );
    return { priceMin, priceMax, tMin, tMax, timeTicks };
  }, [filtered]);

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
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

      <div className="relative">
        <div className="h-48 w-full">
          <Sparkline
            points={filtered}
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

      {view && (
        <div className="flex justify-between text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {view.timeTicks.map((ts, i) => (
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
  const sameDay =
    new Date(rangeStart).toDateString() === new Date(rangeEnd).toDateString();
  const spanMs = rangeEnd - rangeStart;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  const M = d.getMonth() + 1;
  const D = d.getDate();
  if (spanMs < 30 * 24 * 60 * 60 * 1000) return `${M}/${D} ${hh}:${mm}`;
  return `${d.getFullYear()}/${M}/${D}`;
}
