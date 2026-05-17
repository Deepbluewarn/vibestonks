"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { TradeError, executeTrade, type TradeSide } from "@/lib/trade";

// 트레이더당 10초에 15회까지 허용 (사람이 쾌속 클릭해도 안 걸릴 수준,
// 봇이 자동화하면 즉시 차단). 멀티 인스턴스 가면 Redis 기반으로 교체.
const TRADE_RATE = { windowMs: 10_000, max: 15 };

export type TradeActionResult =
  | {
      ok: true;
      side: TradeSide;
      shares: number;
      pointsAmount: number;
      newBalance: number;
      newHolding: number;
    }
  | { ok: false; error: string };

export async function tradeAction(
  tickerId: number,
  shares: number,
  side: TradeSide,
): Promise<TradeActionResult> {
  const session = await auth();
  if (!session?.user?.traderId) return { ok: false, error: "로그인이 필요합니다" };
  if (!Number.isInteger(tickerId) || !Number.isInteger(shares) || shares <= 0) {
    return { ok: false, error: "잘못된 입력" };
  }

  const rl = checkRateLimit(`trade:${session.user.traderId}`, TRADE_RATE);
  if (!rl.ok) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return {
      ok: false,
      error: `너무 빠른 거래 — ${secs}초 후 다시 시도하세요`,
    };
  }

  try {
    const r = executeTrade({
      traderId: session.user.traderId,
      tickerId,
      shares,
      side,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/tickers/${tickerId}`);
    revalidatePath("/history");
    return {
      ok: true,
      side,
      shares,
      pointsAmount: r.pointsAmount,
      newBalance: r.newBalance,
      newHolding: r.newHolding,
    };
  } catch (e) {
    if (e instanceof TradeError) return { ok: false, error: e.message };
    throw e;
  }
}
