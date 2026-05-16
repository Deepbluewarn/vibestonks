"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { TradeError, executeTrade, type TradeSide } from "@/lib/trade";

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
