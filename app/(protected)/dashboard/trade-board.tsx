"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { tradeAction } from "@/lib/actions/trade";
import { buyCost, sellReceipt } from "@/lib/bonding-curve";
import type { HoldingView, TickerWithHistory } from "@/lib/queries";
import { Toast } from "@/components/toast";
import { Sparkline } from "./sparkline";

interface TradeBoardProps {
  tickers: TickerWithHistory[];
  holdings: HoldingView[];
  balance: number;
}

export function TradeBoard({ tickers, holdings, balance }: TradeBoardProps) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const sharesByTicker = new Map(holdings.map((h) => [h.tickerId, h.shares]));

  const submit = (tickerId: number, side: "buy" | "sell", shares: number) => {
    setFlash(null);
    startTransition(async () => {
      const r = await tradeAction(tickerId, shares, side);
      if (r.ok) {
        setFlash({
          ok: true,
          msg: `${side === "buy" ? "매수" : "매도"} ${r.shares}주 (${r.pointsAmount}pt) → 잔고 ${r.newBalance}`,
        });
      } else {
        setFlash({ ok: false, msg: r.error });
      }
    });
  };

  return (
    <section className="space-y-4">
      {flash && (
        <Toast
          message={flash.msg}
          variant={flash.ok ? "success" : "error"}
          onDismiss={() => setFlash(null)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tickers.map((t) => (
          <TickerCard
            key={t.id}
            ticker={t}
            holding={sharesByTicker.get(t.id) ?? 0}
            balance={balance}
            pending={pending}
            onTrade={submit}
          />
        ))}
      </div>
    </section>
  );
}

function TickerCard({
  ticker,
  holding,
  balance,
  pending,
  onTrade,
}: {
  ticker: TickerWithHistory;
  holding: number;
  balance: number;
  pending: boolean;
  onTrade: (tickerId: number, side: "buy" | "sell", shares: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;

  const change = ticker.price - 100;
  const pct = change === 0 ? 0 : (change / 100) * 100;
  const trend =
    change > 0
      ? { color: "text-emerald-600 dark:text-emerald-400", arrow: "▲" }
      : change < 0
        ? { color: "text-rose-600 dark:text-rose-400", arrow: "▼" }
        : { color: "text-gray-400 dark:text-gray-500", arrow: "·" };

  const buyAmount =
    safeQty > 0 ? buyCost(ticker.outstandingShares, safeQty) : 0;
  const sellAmount =
    safeQty > 0 && safeQty <= ticker.outstandingShares
      ? sellReceipt(ticker.outstandingShares, safeQty)
      : 0;
  const canBuy = safeQty > 0 && balance >= buyAmount;
  const canSell = safeQty > 0 && holding >= safeQty;

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <Link
        href={`/tickers/${ticker.id}`}
        className="-m-1 block rounded-md p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        prefetch
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-mono text-sm font-semibold tracking-tight text-gray-900 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400">
            {ticker.name}
          </h3>
          <div className="text-right">
            <div className="text-2xl font-bold leading-none tabular-nums text-gray-900 dark:text-gray-50">
              {ticker.price}
            </div>
            <div
              className={`mt-1 text-[11px] font-medium tabular-nums ${trend.color}`}
            >
              {trend.arrow} {pct > 0 ? "+" : ""}
              {pct.toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="mt-3 h-16 w-full">
          <Sparkline
            points={ticker.history}
            width={320}
            height={64}
            className="h-full w-full"
          />
        </div>
      </Link>

      <div className="mt-3 space-y-2 text-[11px] text-gray-500 dark:text-gray-400">
        <p className="tabular-nums">
          발행 {ticker.outstandingShares} · 보유 {holding}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1">
            <span className="sr-only">수량</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-16 rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              aria-label={`${ticker.name} 거래 수량`}
            />
            <span className="text-[10px] text-gray-400">주</span>
          </label>
          <Btn
            tone="buy"
            disabled={pending || !canBuy}
            onClick={() => onTrade(ticker.id, "buy", safeQty)}
            label={`${ticker.name} ${safeQty}주 매수`}
          >
            매수 {buyAmount > 0 ? `${buyAmount}pt` : ""}
          </Btn>
          <Btn
            tone="sell"
            disabled={pending || !canSell}
            onClick={() => onTrade(ticker.id, "sell", safeQty)}
            label={`${ticker.name} ${safeQty}주 매도`}
          >
            매도 {sellAmount > 0 ? `${sellAmount}pt` : ""}
          </Btn>
          <Btn
            tone="sell"
            disabled={pending || holding < 1}
            onClick={() => onTrade(ticker.id, "sell", holding)}
            label={`${ticker.name} 전량 매도`}
          >
            전량 ({holding})
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Btn({
  tone,
  disabled,
  onClick,
  label,
  children,
}: {
  tone: "buy" | "sell";
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  const palette =
    tone === "buy"
      ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      : "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800/70 dark:text-rose-300 dark:hover:bg-rose-950/40";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${palette}`}
    >
      {children}
    </button>
  );
}
