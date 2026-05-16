import { and, eq, gt } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { liquidationValue } from "./bonding-curve";
import { db as defaultDb, schema } from "./db";
import { publish } from "./events";
import { pickRandomTickers } from "./seed-data/concepts";

const SEED_POINTS = 1000;
const TICKER_COUNT = 5;

export class CycleError extends Error {
  constructor(
    public readonly code: "no_active_week" | "active_week_exists",
    message: string,
  ) {
    super(message);
    this.name = "CycleError";
  }
}

export interface HardResetResult {
  weekId: number;
  tickers: string[];
  tradersUpdated: number;
  previousWeekId: number | null;
}

/**
 * 월요일 09:00 — 주간 하드 리셋.
 * 현재 활성 주차가 있으면 종료, 새 주차 생성, 새 종목 5개 랜덤, 모든 트레이더 잔고 1000.
 * 청산이 안 된 상태에서 호출되면 미실현 포지션은 그냥 증발(데모용). 실제 운영에서는 금요일에
 * liquidate()가 먼저 돌고 나서 월요일에 hardReset()이 도는 게 정상.
 */
export function hardReset(
  database: BetterSQLite3Database<typeof schema> = defaultDb,
): HardResetResult {
  const result = database.transaction((tx) => {
    const active = tx
      .select()
      .from(schema.weeks)
      .where(eq(schema.weeks.isActive, true))
      .get();

    let previousWeekId: number | null = null;
    if (active) {
      previousWeekId = active.id;
      tx.update(schema.weeks)
        .set({ isActive: false, endedAt: new Date() })
        .where(eq(schema.weeks.id, active.id))
        .run();
    }

    const newWeek = tx
      .insert(schema.weeks)
      .values({ startedAt: new Date(), isActive: true })
      .returning()
      .get();

    const picks = pickRandomTickers(TICKER_COUNT);
    for (const name of picks) {
      let ticker = tx
        .select()
        .from(schema.tickers)
        .where(eq(schema.tickers.name, name))
        .get();
      if (!ticker) {
        ticker = tx.insert(schema.tickers).values({ name }).returning().get();
      }
      tx.insert(schema.tickerStates)
        .values({ weekId: newWeek.id, tickerId: ticker.id, outstandingShares: 0 })
        .run();
    }

    const allTraders = tx.select().from(schema.traders).all();
    for (const t of allTraders) {
      tx.insert(schema.balances)
        .values({ weekId: newWeek.id, traderId: t.id, points: SEED_POINTS })
        .run();
      tx.insert(schema.balanceEvents)
        .values({
          traderId: t.id,
          weekId: newWeek.id,
          delta: SEED_POINTS,
          balanceAfter: SEED_POINTS,
          type: "round_reset",
        })
        .run();
    }

    return {
      weekId: newWeek.id,
      tickers: picks,
      tradersUpdated: allTraders.length,
      previousWeekId,
    };
  });

  publish({ type: "reset", weekId: result.weekId });
  return result;
}

export interface LiquidationLine {
  traderId: number;
  tickerId: number;
  shares: number;
  pointsCredited: number;
}

export interface LiquidateResult {
  weekId: number;
  lines: LiquidationLine[];
  totalPaidOut: number;
  /** ADR-0004의 보조금: 실제 풀에 모인 포인트보다 청산 지급액이 얼마 많았는지 */
  subsidy: number;
}

/**
 * 금요일 17:00 — 마감가 일괄 청산.
 * 활성 주차의 모든 보유 주식을 그 시점 가격으로 잔고에 환산하고, 보유 0, 발행주식수 0,
 * 주차를 비활성화. 보조금은 다음 hardReset에서 자연히 사라지므로 별도 처리 없음.
 */
export function liquidate(
  database: BetterSQLite3Database<typeof schema> = defaultDb,
): LiquidateResult {
  const result = database.transaction((tx) => {
    const active = tx
      .select()
      .from(schema.weeks)
      .where(eq(schema.weeks.isActive, true))
      .get();

    if (!active) {
      throw new CycleError("no_active_week", "활성 주차가 없어 청산할 수 없음");
    }

    const states = tx
      .select()
      .from(schema.tickerStates)
      .where(eq(schema.tickerStates.weekId, active.id))
      .all();
    const stateByTicker = new Map(states.map((s) => [s.tickerId, s.outstandingShares]));

    const heldRows = tx
      .select()
      .from(schema.holdings)
      .where(
        and(eq(schema.holdings.weekId, active.id), gt(schema.holdings.shares, 0)),
      )
      .all();

    const lines: LiquidationLine[] = [];
    let totalPaidOut = 0;

    for (const h of heldRows) {
      const outstanding = stateByTicker.get(h.tickerId) ?? 0;
      const value = liquidationValue(outstanding, h.shares);

      const bal = tx
        .select()
        .from(schema.balances)
        .where(
          and(
            eq(schema.balances.weekId, active.id),
            eq(schema.balances.traderId, h.traderId),
          ),
        )
        .get();

      tx.update(schema.balances)
        .set({ points: (bal?.points ?? 0) + value })
        .where(
          and(
            eq(schema.balances.weekId, active.id),
            eq(schema.balances.traderId, h.traderId),
          ),
        )
        .run();

      tx.update(schema.holdings)
        .set({ shares: 0 })
        .where(
          and(
            eq(schema.holdings.weekId, active.id),
            eq(schema.holdings.traderId, h.traderId),
            eq(schema.holdings.tickerId, h.tickerId),
          ),
        )
        .run();

      tx.insert(schema.trades)
        .values({
          weekId: active.id,
          traderId: h.traderId,
          tickerId: h.tickerId,
          side: "liquidation",
          shares: h.shares,
          points: value,
        })
        .run();

      tx.insert(schema.balanceEvents)
        .values({
          traderId: h.traderId,
          weekId: active.id,
          tickerId: h.tickerId,
          delta: value,
          balanceAfter: (bal?.points ?? 0) + value,
          type: "liquidation",
        })
        .run();

      lines.push({
        traderId: h.traderId,
        tickerId: h.tickerId,
        shares: h.shares,
        pointsCredited: value,
      });
      totalPaidOut += value;
    }

    tx.update(schema.tickerStates)
      .set({ outstandingShares: 0 })
      .where(eq(schema.tickerStates.weekId, active.id))
      .run();

    tx.update(schema.weeks)
      .set({ isActive: false, endedAt: new Date() })
      .where(eq(schema.weeks.id, active.id))
      .run();

    // 보조금 = 청산 지급 총액 − 풀이 실제로 모은 포인트
    // 풀이 모은 포인트 = 같은 주차의 buy 합 − sell 합
    const tradeRows = tx
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.weekId, active.id))
      .all();
    let poolCollected = 0;
    for (const t of tradeRows) {
      if (t.side === "buy") poolCollected += -t.points; // buy points는 음수로 저장
      else if (t.side === "sell") poolCollected -= t.points;
      // liquidation은 풀에서 나가는 게 아니라 시스템이 만들어주는 거라 제외
    }
    const subsidy = totalPaidOut - poolCollected;

    return { weekId: active.id, lines, totalPaidOut, subsidy };
  });

  publish({ type: "liquidation", weekId: result.weekId });
  return result;
}
