"use server";

import { eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { startBots, stopBots } from "@/lib/bots/runner";
import { db, schema } from "@/lib/db";
import { hardReset, liquidate } from "@/lib/cycle";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.traderId) return { ok: false, error: "로그인 필요" };
  if (!session.user.isAdmin) return { ok: false, error: "관리자 권한 필요" };
  return { ok: true };
}

export type AdminActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function adminLiquidate(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    const r = liquidate();
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Week ${r.weekId} 청산 완료 · ${r.lines.length}건 · 보조금 ${r.subsidy}pt`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "청산 실패" };
  }
}

export async function adminReset(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    const r = hardReset();
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Week ${r.weekId} 시작 · 종목 ${r.tickers.join(", ")} · 트레이더 ${r.tradersUpdated}명 잔고 1000`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "리셋 실패" };
  }
}

export async function adminRotate(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    const liq = liquidate();
    const reset = hardReset();
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Week ${liq.weekId} 청산 (보조금 ${liq.subsidy}pt) → Week ${reset.weekId} 시작 (${reset.tickers.join(", ")})`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "회전 실패" };
  }
}

export async function adminRenameTicker(
  tickerId: number,
  newName: string,
): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  const name = newName.trim();
  if (name.length < 1 || name.length > 30) {
    return { ok: false, error: "1~30자" };
  }
  try {
    const existing = db
      .select()
      .from(schema.tickers)
      .where(eq(schema.tickers.name, name))
      .get();
    if (existing && existing.id !== tickerId) {
      return { ok: false, error: "같은 이름의 종목이 이미 있습니다" };
    }
    db.update(schema.tickers)
      .set({ name })
      .where(eq(schema.tickers.id, tickerId))
      .run();
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath(`/tickers/${tickerId}`);
    return { ok: true, message: `이름 변경: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "변경 실패" };
  }
}

export async function adminBotStart(
  count: number,
  speed: number,
): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!Number.isFinite(count) || count < 0 || count > 1000) {
    return { ok: false, error: "수량은 0~1000" };
  }
  if (!Number.isFinite(speed) || speed < 0.1 || speed > 100) {
    return { ok: false, error: "속도는 0.1~100배" };
  }
  try {
    startBots({ count, speed });
    revalidatePath("/admin");
    return {
      ok: true,
      message: `봇 ${count}명 시작 (속도 ×${speed})`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "시작 실패" };
  }
}

export async function adminBotStop(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    stopBots();
    revalidatePath("/admin");
    return { ok: true, message: "봇 중지" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "중지 실패" };
  }
}

export async function adminFullWipe(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    db.transaction((tx) => {
      tx.delete(schema.trades).run();
      tx.delete(schema.balanceEvents).run();
      tx.delete(schema.holdings).run();
      tx.delete(schema.balances).run();
      tx.delete(schema.tickerStates).run();
      tx.delete(schema.weeks).run();
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    revalidatePath("/history");
    return {
      ok: true,
      message:
        "전체 초기화 완료. 트레이더 계정·종목 목록만 남음. '🚀 새 라운드 시작' 누르세요.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "초기화 실패",
    };
  }
}

export async function adminBotRemove(): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    // 먼저 멈춰야 새로 안 만들어짐
    stopBots();
    const bots = db
      .select({ id: schema.traders.id })
      .from(schema.traders)
      .where(like(schema.traders.sub, "bot:%"))
      .all();
    if (bots.length === 0) {
      return { ok: true, message: "삭제할 봇 없음" };
    }
    const ids = bots.map((b) => b.id);
    db.transaction((tx) => {
      tx.delete(schema.trades).where(inArray(schema.trades.traderId, ids)).run();
      tx.delete(schema.balanceEvents).where(inArray(schema.balanceEvents.traderId, ids)).run();
      tx.delete(schema.holdings).where(inArray(schema.holdings.traderId, ids)).run();
      tx.delete(schema.balances).where(inArray(schema.balances.traderId, ids)).run();
      tx.delete(schema.traders).where(inArray(schema.traders.id, ids)).run();
    });
    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return { ok: true, message: `봇 ${bots.length}명 + 관련 데이터 삭제` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "삭제 실패" };
  }
}

export async function adminToggleTraderAdmin(
  targetTraderId: number,
): Promise<AdminActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  try {
    const t = db
      .select()
      .from(schema.traders)
      .where(eq(schema.traders.id, targetTraderId))
      .get();
    if (!t) return { ok: false, error: "트레이더 없음" };
    db.update(schema.traders)
      .set({ isAdmin: !t.isAdmin })
      .where(eq(schema.traders.id, targetTraderId))
      .run();
    revalidatePath("/admin");
    return {
      ok: true,
      message: `${t.displayName}: ${t.isAdmin ? "권한 해제" : "관리자 권한 부여"}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "토글 실패" };
  }
}
