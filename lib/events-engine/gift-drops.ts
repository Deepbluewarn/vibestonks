/**
 * 보너스 드롭 — 모든 활성 라운드 트레이더에게 소량 현금을 지급.
 *
 * 두 가지 사용 방식:
 *   1. 자동 (startGifts): 백그라운드 스케줄러가 minIntervalMs~maxIntervalMs 사이
 *      랜덤 간격으로 깨어나 minAmount~maxAmount 사이 랜덤 금액 지급.
 *   2. 수동 (payGiftNow): 운영자가 즉시 모든 트레이더에게 정해진 금액 지급.
 *
 * 의도: 거래가 풀에 돈을 빨아들이면서 유저/봇 잔고가 마르는 걸 보충 → 거래 활성도
 *      유지. 변동성/유동성 마중물 역할.
 *
 * 한 번의 드롭:
 *   - 모든 활성 라운드 balance row에 동일 금액 추가
 *   - balance_events에 type='gift'로 기록
 *   - SSE trade 이벤트 publish (대시보드 즉시 갱신)
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { publish } from "@/lib/events";

interface GiftState {
  running: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  minAmount: number;
  maxAmount: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULTS: Omit<GiftState, "timer"> = {
  running: false,
  minIntervalMs: 2_700_000, // 45분
  maxIntervalMs: 4_500_000, // 75분 — 1시간 ±15분
  minAmount: 20,
  maxAmount: 40,
};

const globalForGifts = globalThis as unknown as {
  __antstockGiftState?: GiftState;
};

function getState(): GiftState {
  if (!globalForGifts.__antstockGiftState) {
    globalForGifts.__antstockGiftState = { ...DEFAULTS, timer: null };
  }
  return globalForGifts.__antstockGiftState;
}

export interface GiftStatus {
  running: boolean;
  minIntervalSec: number;
  maxIntervalSec: number;
  minAmount: number;
  maxAmount: number;
}

export function getGiftStatus(): GiftStatus {
  const s = getState();
  return {
    running: s.running,
    minIntervalSec: Math.round(s.minIntervalMs / 1000),
    maxIntervalSec: Math.round(s.maxIntervalMs / 1000),
    minAmount: s.minAmount,
    maxAmount: s.maxAmount,
  };
}

export interface GiftConfig {
  minIntervalSec?: number;
  maxIntervalSec?: number;
  minAmount?: number;
  maxAmount?: number;
}

export function startGifts(cfg: GiftConfig = {}): void {
  const s = getState();
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  if (cfg.minIntervalSec !== undefined) s.minIntervalMs = cfg.minIntervalSec * 1000;
  if (cfg.maxIntervalSec !== undefined) s.maxIntervalMs = cfg.maxIntervalSec * 1000;
  if (cfg.minAmount !== undefined) s.minAmount = cfg.minAmount;
  if (cfg.maxAmount !== undefined) s.maxAmount = cfg.maxAmount;
  if (s.maxIntervalMs < s.minIntervalMs) s.maxIntervalMs = s.minIntervalMs;
  if (s.maxAmount < s.minAmount) s.maxAmount = s.minAmount;
  s.running = true;
  scheduleNext();
  console.log(
    `[gifts] started — ${s.minIntervalMs / 1000}~${s.maxIntervalMs / 1000}s 간격, ${s.minAmount}~${s.maxAmount}pt`,
  );
}

export function stopGifts(): void {
  const s = getState();
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  s.running = false;
  console.log("[gifts] stopped");
}

function scheduleNext(): void {
  const s = getState();
  if (!s.running) return;
  const delay = Math.max(
    1000,
    Math.floor(Math.random() * (s.maxIntervalMs - s.minIntervalMs + 1)) +
      s.minIntervalMs,
  );
  s.timer = setTimeout(() => {
    const amount =
      Math.floor(Math.random() * (s.maxAmount - s.minAmount + 1)) + s.minAmount;
    try {
      payGiftNow(amount);
    } catch (e) {
      console.error("[gifts] drop failed", e);
    } finally {
      scheduleNext();
    }
  }, delay);
}

/**
 * 즉시 한 번 모든 활성 라운드 트레이더에게 amount 만큼 지급.
 * 운영자 수동 지급에서도 동일하게 호출.
 *
 * @returns 입금된 트레이더 수
 */
export function payGiftNow(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const week = db
    .select()
    .from(schema.weeks)
    .where(eq(schema.weeks.isActive, true))
    .get();
  if (!week) return 0;

  let count = 0;
  db.transaction((tx) => {
    const balances = tx
      .select()
      .from(schema.balances)
      .where(eq(schema.balances.weekId, week.id))
      .all();
    for (const b of balances) {
      const newBalance = b.points + amount;
      tx.update(schema.balances)
        .set({ points: newBalance })
        .where(
          and(
            eq(schema.balances.weekId, week.id),
            eq(schema.balances.traderId, b.traderId),
          ),
        )
        .run();
      tx.insert(schema.balanceEvents)
        .values({
          traderId: b.traderId,
          weekId: week.id,
          delta: amount,
          balanceAfter: newBalance,
          type: "gift",
        })
        .run();
      count += 1;
    }
  });
  if (count > 0) {
    // tickerId=-1 합성 이벤트로 SSE 트리거. 잔고/랭킹 등이 즉시 갱신.
    publish({ type: "trade", tickerId: -1, price: 0, outstandingShares: 0 });
    console.log(`[gifts] +${amount}pt × ${count}명`);
  }
  return count;
}

/**
 * 특정 트레이더 한 명에게 amount 만큼 지급. amount 음수면 차감(잔고가 음수가 되지는 않게 0 floor).
 * @returns 지급 후 잔고 / null = 트레이더가 활성 라운드 balance row 없음
 */
export function payGiftToTrader(
  traderId: number,
  amount: number,
): number | null {
  if (!Number.isFinite(amount) || amount === 0) return null;
  const week = db
    .select()
    .from(schema.weeks)
    .where(eq(schema.weeks.isActive, true))
    .get();
  if (!week) return null;

  let result: number | null = null;
  db.transaction((tx) => {
    const b = tx
      .select()
      .from(schema.balances)
      .where(
        and(
          eq(schema.balances.weekId, week.id),
          eq(schema.balances.traderId, traderId),
        ),
      )
      .get();
    if (!b) return;
    const newBalance = Math.max(0, b.points + amount);
    const delta = newBalance - b.points;
    if (delta === 0) {
      result = b.points;
      return;
    }
    tx.update(schema.balances)
      .set({ points: newBalance })
      .where(
        and(
          eq(schema.balances.weekId, week.id),
          eq(schema.balances.traderId, traderId),
        ),
      )
      .run();
    tx.insert(schema.balanceEvents)
      .values({
        traderId,
        weekId: week.id,
        delta,
        balanceAfter: newBalance,
        type: "gift",
      })
      .run();
    result = newBalance;
  });
  if (result !== null) {
    publish({ type: "trade", tickerId: -1, price: 0, outstandingShares: 0 });
    console.log(`[gifts] trader ${traderId} ${amount >= 0 ? "+" : ""}${amount}pt → ${result}`);
  }
  return result;
}
