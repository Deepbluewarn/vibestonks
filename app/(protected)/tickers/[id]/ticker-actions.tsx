"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tradeAction } from "@/lib/actions/trade";
import { Toast } from "@/components/toast";

interface Props {
  tickerId: number;
  price: number;
  balance: number;
  myShares: number;
}

export function TickerActions({ tickerId, price, balance, myShares }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

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
      <div className="flex flex-wrap gap-2">
        <Btn
          tone="buy"
          disabled={pending || balance < price + 1}
          onClick={() => submit("buy", 1)}
        >
          +1 매수
        </Btn>
        <Btn
          tone="buy"
          disabled={pending || balance < price * 5 + 25}
          onClick={() => submit("buy", 5)}
        >
          +5 매수
        </Btn>
        <Btn
          tone="sell"
          disabled={pending || myShares < 1}
          onClick={() => submit("sell", 1)}
        >
          -1 매도
        </Btn>
        <Btn
          tone="sell"
          disabled={pending || myShares < 1}
          onClick={() => submit("sell", myShares)}
        >
          전량 매도
        </Btn>
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
