"use client";

import { useId, useMemo, useState } from "react";
import type { PricePoint } from "@/lib/queries";

interface SparklineProps {
  points: PricePoint[];
  width?: number;
  height?: number;
  className?: string;
  /** true 시 거래 시점마다 hover 가능한 점 + 툴팁 */
  interactive?: boolean;
}

/**
 * 차트 경로는 SVG로 그리되 점/펄스/툴팁은 HTML로 오버레이.
 * SVG preserveAspectRatio="none"이 시각요소를 늘리지 못하게 분리 — 컨테이너 비율과
 * 상관없이 점은 항상 동그라미.
 */
export function Sparkline({
  points,
  width = 320,
  height = 64,
  className = "",
  interactive = false,
}: SparklineProps) {
  const id = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const view = useMemo(() => buildView(points, width, height), [
    points,
    width,
    height,
  ]);

  if (!view) {
    return (
      <div className={`relative ${className}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="#cbd5e1"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  }

  const { linePath, areaPath, stroke, lastPct, dotPcts } = view;
  const gradId = `spark-grad-${id}`;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* 마지막 점 펄스 */}
      <span
        className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${lastPct.x}%`,
          top: `${lastPct.y}%`,
          backgroundColor: stroke,
        }}
      >
        <span
          className="absolute inset-[-4px] animate-ping rounded-full opacity-50"
          style={{ backgroundColor: stroke }}
        />
      </span>

      {/* 거래 시점 인터랙티브 점 */}
      {interactive &&
        dotPcts.map((d) => (
          <button
            key={d.idx}
            type="button"
            aria-label={`${d.side === "buy" ? "매수" : "매도"} ${d.shares}주, ${d.price}pt`}
            onMouseEnter={() => setHoverIdx(d.idx)}
            onMouseLeave={() => setHoverIdx((cur) => (cur === d.idx ? null : cur))}
            onFocus={() => setHoverIdx(d.idx)}
            onBlur={() => setHoverIdx((cur) => (cur === d.idx ? null : cur))}
            className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-indigo-300 hover:scale-125 dark:border-gray-900 ${
              hoverIdx === d.idx ? "scale-125" : ""
            }`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              backgroundColor: d.side === "buy" ? "#059669" : "#e11d48",
            }}
          />
        ))}

      {/* 툴팁 (HTML, 완벽 라운드 + tailwind 다크) */}
      {interactive && hoverIdx !== null && dotPcts[lookupDotIdx(dotPcts, hoverIdx)] && (() => {
        const dot = dotPcts.find((d) => d.idx === hoverIdx);
        if (!dot) return null;
        const isLeft = dot.x < 50;
        const isTop = dot.y < 50;
        return (
          <div
            className="pointer-events-none absolute z-10 min-w-[110px] rounded-md border border-white/10 bg-gray-900/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur dark:border-white/5"
            style={{
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              transform: `translate(${isLeft ? "8px" : "calc(-100% - 8px)"}, ${
                isTop ? "8px" : "calc(-100% - 8px)"
              })`,
            }}
          >
            <p className="font-semibold leading-tight">
              <span
                className={
                  dot.side === "buy"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }
              >
                {dot.side === "buy" ? "매수" : "매도"}
              </span>
              <span className="text-white">
                {" "}
                {dot.shares}주 · {dot.price}pt
              </span>
            </p>
            <p className="leading-tight text-white/55">
              {formatHM(dot.t)}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

function lookupDotIdx(
  dots: { idx: number }[],
  hoverIdx: number,
): number {
  return dots.findIndex((d) => d.idx === hoverIdx);
}

function formatHM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DotPct {
  idx: number;
  x: number;
  y: number;
  side: "buy" | "sell";
  shares: number;
  price: number;
  t: number;
}

function buildView(points: PricePoint[], width: number, height: number) {
  if (points.length < 2) return null;
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tRange = Math.max(1, tMax - tMin);

  const prices = points.map((p) => p.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pRange = Math.max(1, pMax - pMin);

  const PAD_X = 2;
  const PAD_Y = 6;
  const innerW = width - PAD_X * 2;
  const innerH = height - PAD_Y * 2;

  const xys = points.map((p) => ({
    x: PAD_X + ((p.t - tMin) / tRange) * innerW,
    y:
      pRange === 1 && pMin === pMax
        ? PAD_Y + innerH / 2
        : PAD_Y + innerH - ((p.price - pMin) / pRange) * innerH,
  }));

  const linePath = xys
    .map((p, i) =>
      i === 0
        ? `M${p.x.toFixed(2)},${p.y.toFixed(2)}`
        : `L${p.x.toFixed(2)},${p.y.toFixed(2)}`,
    )
    .join(" ");
  const first = xys[0];
  const last = xys[xys.length - 1];
  const areaPath = `${linePath} L${last.x.toFixed(2)},${height} L${first.x.toFixed(2)},${height} Z`;

  const change = points[points.length - 1].price - points[0].price;
  const stroke =
    change > 0 ? "#059669" : change < 0 ? "#e11d48" : "#94a3b8";

  // viewBox 좌표를 컨테이너 % 좌표로 변환 (HTML 오버레이용)
  const toPct = (xy: { x: number; y: number }) => ({
    x: (xy.x / width) * 100,
    y: (xy.y / height) * 100,
  });

  const lastPct = toPct(last);

  const dotPcts: DotPct[] = [];
  points.forEach((p, i) => {
    if (!p.side || !p.shares) return;
    const pct = toPct(xys[i]);
    dotPcts.push({
      idx: i,
      x: pct.x,
      y: pct.y,
      side: p.side,
      shares: p.shares,
      price: p.price,
      t: p.t,
    });
  });

  return { linePath, areaPath, stroke, lastPct, dotPcts };
}
