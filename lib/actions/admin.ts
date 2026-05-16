"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
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
