"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tradeAction } from "@/lib/actions/trade";
import { buyCost, sellReceipt } from "@/lib/bonding-curve";
import { Toast } from "@/components/toast";

interface Props {
  tickerId: number;
  outstandingShares: number;
  balance: number;
  myShares: number;
}

export function TickerActions({
  tickerId,
  outstandingShares,
  balance,
  myShares,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [qty, setQty] = useState(1);

  const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  const buyAmount = safeQty > 0 ? buyCost(outstandingShares, safeQty) : 0;
  const sellAmount =
    safeQty > 0 && safeQty <= outstandingShares
      ? sellReceipt(outstandingShares, safeQty)
      : 0;
  const canBuy = safeQty > 0 && balance >= buyAmount;
  const canSell = safeQty > 0 && myShares >= safeQty;

  const submit = (side: "buy" | "sell", shares: number) => {
    setFlash(null);
    startTransition(async () => {
      const r = await tradeAction(tickerId, shares, side);
      if (r.ok) {
        setFlash({
          ok: true,
          msg: `${side === "buy" ? "매수" : "매도"} ${r.shares}주 (${r.pointsAmount}pt) → 잔고 ${r.newBalance}`,
        });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: r.error });
      }
    });
  };

  return (
    <div className="space-y-3">
      {flash && (
        <Toast
          message={flash.msg}
          variant={flash.ok ? "success" : "error"}
          onDismiss={() => setFlash(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            수량
          </span>
          <input
            type="number"
            min={1}
            max={9999}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-24 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            aria-label="거래 수량"
          />
          <span className="text-xs text-gray-400 dark:text-gray-500">주</span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Btn
            tone="buy"
            disabled={pending || !canBuy}
            onClick={() => submit("buy", safeQty)}
          >
            매수 {buyAmount > 0 ? `${buyAmount}pt` : ""}
          </Btn>
          <Btn
            tone="sell"
            disabled={pending || !canSell}
            onClick={() => submit("sell", safeQty)}
          >
            매도 {sellAmount > 0 ? `${sellAmount}pt` : ""}
          </Btn>
          <Btn
            tone="sell"
            disabled={pending || myShares < 1}
            onClick={() => submit("sell", myShares)}
          >
            전량 매도 ({myShares})
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
  children,
}: {
  tone: "buy" | "sell";
  disabled?: boolean;
  onClick: () => void;
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
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${palette}`}
    >
      {children}
    </button>
  );
}
