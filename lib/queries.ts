/**
 * 공용 데이터 조회 함수. Server Component와 API route handler 양쪽에서 사용.
 * 모두 동기 (better-sqlite3) 호출이므로 Promise를 반환하지 않음.
 */
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { BASE_PRICE, SLOPE, currentPrice } from "./bonding-curve";
import { db, schema } from "./db";

export interface ActiveWeek {
  id: number;
  startedAt: Date;
}

export function getActiveWeek(): ActiveWeek | null {
  const w = db
    .select()
    .from(schema.weeks)
    .where(eq(schema.weeks.isActive, true))
    .get();
  return w ? { id: w.id, startedAt: w.startedAt } : null;
}

export interface TickerSnapshot {
  id: number;
  name: string;
  price: number;
  outstandingShares: number;
}

export interface AdminTraderRow {
  id: number;
  sub: string;
  displayName: string;
  isAdmin: boolean;
  onboarded: boolean;
  createdAt: number;
  currentBalance: number | null;
}

export function getAllTraders(): AdminTraderRow[] {
  const week = getActiveWeek();
  const traders = db
    .select()
    .from(schema.traders)
    .orderBy(desc(schema.traders.createdAt))
    .all();
  let balancesByTrader: Map<number, number> | null = null;
  if (week) {
    const bals = db
      .select()
      .from(schema.balances)
      .where(eq(schema.balances.weekId, week.id))
      .all();
    balancesByTrader = new Map(bals.map((b) => [b.traderId, b.points]));
  }
  return traders.map((t) => ({
    id: t.id,
    sub: t.sub,
    displayName: t.displayName,
    isAdmin: t.isAdmin,
    onboarded: t.onboardedAt !== null,
    createdAt: t.createdAt.getTime(),
    currentBalance: balancesByTrader ? (balancesByTrader.get(t.id) ?? null) : null,
  }));
}

export interface AdminStats {
  activeWeek: { id: number; startedAt: number } | null;
  totalTraders: number;
  totalTickers: number;
  totalTrades: number;
  totalOutstandingShares: number;
  poolBalance: number;
  cumulativeSubsidy: number;
}

export function getAdminStats(): AdminStats {
  const week = getActiveWeek();
  const totalTraders = db.select().from(schema.traders).all().length;
  const totalTickers = db.select().from(schema.tickers).all().length;
  const totalTrades = db.select().from(schema.trades).all().length;

  let totalOutstandingShares = 0;
  let poolBalance = 0;
  let cumulativeSubsidy = 0;
  if (week) {
    const states = db
      .select()
      .from(schema.tickerStates)
      .where(eq(schema.tickerStates.weekId, week.id))
      .all();
    totalOutstandingShares = states.reduce((s, x) => s + x.outstandingShares, 0);

    const allTradesThisWeek = db
      .select()
      .from(schema.trades)
      .where(eq(schema.trades.weekId, week.id))
      .all();
    let collected = 0;
    let liquidated = 0;
    for (const t of allTradesThisWeek) {
      if (t.side === "buy") collected += -t.points;
      else if (t.side === "sell") collected -= t.points;
      else if (t.side === "liquidation") liquidated += t.points;
    }
    poolBalance = collected;
    cumulativeSubsidy = liquidated - collected;
  }

  return {
    activeWeek: week ? { id: week.id, startedAt: week.startedAt.getTime() } : null,
    totalTraders,
    totalTickers,
    totalTrades,
    totalOutstandingShares,
    poolBalance,
    cumulativeSubsidy,
  };
}

export interface PricePoint {
  /** Unix ms */
  t: number;
  price: number;
  /** 거래에서 비롯된 점인 경우 — 시작/현재 동기화 점은 undefined */
  side?: "buy" | "sell";
  shares?: number;
}

/**
 * 그 주차의 가격 시계열 재구성. buy/sell 거래마다 step 시리즈, liquidation은 제외.
 *
 * 시간 범위는 활동 기준으로 자름:
 * - 거래 0건: 주차 시작 → 지금 (평평한 100 라인)
 * - 거래 1건 이상: [첫 거래 직전 앵커] ~ [마지막 거래] 까지만
 *   - 앵커는 활동 폭의 5% 또는 최소 1초 만큼 첫 거래보다 앞에. 가격 점프 시각화용.
 *   - "지금"까지 라인을 연장하지 않음 — 마지막 거래 이후 무활동 구간이 차트를 차지하는
 *     문제 방지. 마지막 점의 펄스가 "현재 상태" 역할.
 *   - 차트 기간 토글의 1일/1주/... 모드에선 [now - range, now] 윈도우를 강제하므로
 *     사용자가 명시적으로 "현재까지" 보고 싶을 땐 그 탭을 쓰면 됨.
 */
export function getPriceHistory(
  weekId: number,
  tickerId: number,
  weekStartedAt: Date,
): PricePoint[] {
  const tradeRows = db
    .select({
      executedAt: schema.trades.executedAt,
      side: schema.trades.side,
      shares: schema.trades.shares,
    })
    .from(schema.trades)
    .where(
      and(
        eq(schema.trades.weekId, weekId),
        eq(schema.trades.tickerId, tickerId),
      ),
    )
    .orderBy(asc(schema.trades.executedAt))
    .all();

  const buySellRows = tradeRows.filter(
    (t) => t.side === "buy" || t.side === "sell",
  );

  if (buySellRows.length === 0) {
    return [
      { t: weekStartedAt.getTime(), price: BASE_PRICE },
      { t: Date.now(), price: BASE_PRICE },
    ];
  }

  const firstTradeT = buySellRows[0].executedAt.getTime();
  const lastTradeT = buySellRows[buySellRows.length - 1].executedAt.getTime();
  const activitySpan = Math.max(0, lastTradeT - firstTradeT);
  const leftBuffer = Math.max(activitySpan * 0.05, 1000);
  const anchorT = Math.max(firstTradeT - leftBuffer, weekStartedAt.getTime());

  let outstanding = 0;
  const series: PricePoint[] = [{ t: anchorT, price: BASE_PRICE }];
  for (const t of buySellRows) {
    if (t.side === "buy") outstanding += t.shares;
    else outstanding -= t.shares;
    series.push({
      t: t.executedAt.getTime(),
      price: BASE_PRICE + SLOPE * outstanding,
      side: t.side as "buy" | "sell",
      shares: t.shares,
    });
  }
  return series;
}

export interface TickerWithHistory extends TickerSnapshot {
  history: PricePoint[];
}

export function getCurrentTickersWithHistory(): TickerWithHistory[] {
  const week = getActiveWeek();
  if (!week) return [];
  return getCurrentTickers().map((t) => ({
    ...t,
    history: getPriceHistory(week.id, t.id, week.startedAt),
  }));
}

export function getCurrentTickers(): TickerSnapshot[] {
  const week = getActiveWeek();
  if (!week) return [];
  const rows = db
    .select({
      id: schema.tickers.id,
      name: schema.tickers.name,
      outstandingShares: schema.tickerStates.outstandingShares,
    })
    .from(schema.tickerStates)
    .innerJoin(schema.tickers, eq(schema.tickerStates.tickerId, schema.tickers.id))
    .where(eq(schema.tickerStates.weekId, week.id))
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    outstandingShares: r.outstandingShares,
    price: currentPrice(r.outstandingShares),
  }));
}

export interface HoldingView {
  tickerId: number;
  tickerName: string;
  shares: number;
  price: number;
  value: number;
}

export interface MyState {
  balance: number;
  holdings: HoldingView[];
  portfolioValue: number;
}

export function getMyState(traderId: number): MyState | null {
  const week = getActiveWeek();
  if (!week) return null;
  const bal = db
    .select()
    .from(schema.balances)
    .where(
      and(
        eq(schema.balances.weekId, week.id),
        eq(schema.balances.traderId, traderId),
      ),
    )
    .get();
  const holdRows = db
    .select({
      tickerId: schema.holdings.tickerId,
      tickerName: schema.tickers.name,
      shares: schema.holdings.shares,
      outstandingShares: schema.tickerStates.outstandingShares,
    })
    .from(schema.holdings)
    .innerJoin(schema.tickers, eq(schema.holdings.tickerId, schema.tickers.id))
    .innerJoin(
      schema.tickerStates,
      and(
        eq(schema.tickerStates.weekId, schema.holdings.weekId),
        eq(schema.tickerStates.tickerId, schema.holdings.tickerId),
      ),
    )
    .where(
      and(
        eq(schema.holdings.weekId, week.id),
        eq(schema.holdings.traderId, traderId),
        gt(schema.holdings.shares, 0),
      ),
    )
    .all();

  const holdings: HoldingView[] = holdRows.map((h) => ({
    tickerId: h.tickerId,
    tickerName: h.tickerName,
    shares: h.shares,
    price: currentPrice(h.outstandingShares),
    value: currentPrice(h.outstandingShares) * h.shares,
  }));
  const balance = bal?.points ?? 0;
  const portfolioValue = balance + holdings.reduce((s, h) => s + h.value, 0);
  return { balance, holdings, portfolioValue };
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  points: number;
}

export interface LeaderboardResult {
  top3: LeaderboardEntry[];
  myRank: number | null;
  totalTraders: number;
  /** 1위와의 잔고 차 (음수 = 내가 부족) — myRank가 1이면 null */
  gapToTop: number | null;
  /** 바로 위 등수와의 잔고 차 — myRank가 1이면 null */
  gapToNext: number | null;
}

export interface TickerTrade {
  id: number;
  side: "buy" | "sell";
  shares: number;
  pointsAbs: number;
  executedAt: number;
  isMe: boolean;
}

export interface TickerDetail extends TickerSnapshot {
  history: PricePoint[];
  recentTrades: TickerTrade[];
  myShares: number;
}

/**
 * 종목 한 개의 상세: 가격 시계열, 최근 거래 30건(익명), 본인 보유.
 * recentTrades의 isMe 플래그로 클라이언트가 "나/익명" 라벨링 가능.
 */
export function getTickerDetail(
  tickerId: number,
  myTraderId?: number,
): TickerDetail | null {
  const week = getActiveWeek();
  if (!week) return null;
  const tickerRow = db
    .select()
    .from(schema.tickers)
    .where(eq(schema.tickers.id, tickerId))
    .get();
  if (!tickerRow) return null;

  const stateRow = db
    .select()
    .from(schema.tickerStates)
    .where(
      and(
        eq(schema.tickerStates.weekId, week.id),
        eq(schema.tickerStates.tickerId, tickerId),
      ),
    )
    .get();
  if (!stateRow) return null;

  const outstandingShares = stateRow.outstandingShares;
  const ticker: TickerSnapshot = {
    id: tickerRow.id,
    name: tickerRow.name,
    outstandingShares,
    price: currentPrice(outstandingShares),
  };

  const history = getPriceHistory(week.id, tickerId, week.startedAt);

  const tradeRows = db
    .select()
    .from(schema.trades)
    .where(
      and(
        eq(schema.trades.weekId, week.id),
        eq(schema.trades.tickerId, tickerId),
      ),
    )
    .orderBy(desc(schema.trades.executedAt))
    .limit(30)
    .all();

  const recentTrades: TickerTrade[] = tradeRows
    .filter((t) => t.side === "buy" || t.side === "sell")
    .map((t) => ({
      id: t.id,
      side: t.side as "buy" | "sell",
      shares: t.shares,
      pointsAbs: Math.abs(t.points),
      executedAt: t.executedAt.getTime(),
      isMe: myTraderId !== undefined && t.traderId === myTraderId,
    }));

  let myShares = 0;
  if (myTraderId !== undefined) {
    const h = db
      .select()
      .from(schema.holdings)
      .where(
        and(
          eq(schema.holdings.weekId, week.id),
          eq(schema.holdings.traderId, myTraderId),
          eq(schema.holdings.tickerId, tickerId),
        ),
      )
      .get();
    myShares = h?.shares ?? 0;
  }

  return { ...ticker, history, recentTrades, myShares };
}

export interface BalanceHistoryEntry {
  id: number;
  type: "buy" | "sell" | "liquidation" | "salary" | "init" | "round_reset";
  delta: number;
  balanceAfter: number;
  tickerName: string | null;
  weekId: number | null;
  occurredAt: number;
}

export type BalanceEventType =
  | "buy"
  | "sell"
  | "liquidation"
  | "salary"
  | "init"
  | "round_reset";

/**
 * 본인 잔고 변동 로그. 최신순. type 필터 가능 (지정하면 해당 타입들만).
 * 페이지네이션은 offset 기반. 총 개수는 별도 쿼리.
 */
export function getMyBalanceHistory(
  traderId: number,
  opts: { types?: BalanceEventType[]; limit?: number; offset?: number } = {},
): { rows: BalanceHistoryEntry[]; total: number } {
  const { types, limit = 50, offset = 0 } = opts;
  const filters = [eq(schema.balanceEvents.traderId, traderId)];
  if (types && types.length > 0) {
    filters.push(inArray(schema.balanceEvents.type, types));
  }

  const totalRow = db
    .select({ c: sql<number>`count(*)` })
    .from(schema.balanceEvents)
    .where(and(...filters))
    .get();
  const total = totalRow?.c ?? 0;

  const rows = db
    .select({
      id: schema.balanceEvents.id,
      type: schema.balanceEvents.type,
      delta: schema.balanceEvents.delta,
      balanceAfter: schema.balanceEvents.balanceAfter,
      tickerId: schema.balanceEvents.tickerId,
      tickerName: schema.tickers.name,
      weekId: schema.balanceEvents.weekId,
      occurredAt: schema.balanceEvents.occurredAt,
    })
    .from(schema.balanceEvents)
    .leftJoin(
      schema.tickers,
      eq(schema.balanceEvents.tickerId, schema.tickers.id),
    )
    .where(and(...filters))
    .orderBy(desc(schema.balanceEvents.occurredAt), desc(schema.balanceEvents.id))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      delta: r.delta,
      balanceAfter: r.balanceAfter,
      tickerName: r.tickerName ?? null,
      weekId: r.weekId,
      occurredAt: r.occurredAt.getTime(),
    })),
    total,
  };
}

/**
 * 활성 주차 기준 잔고 내림차순 랭킹. 프라이버시 모델(ADR-0005)에 따라
 * 상위 3명만 이름+잔고 공개, 그 외엔 본인 등수만 의미 있음.
 */
export function getLeaderboard(myTraderId?: number): LeaderboardResult {
  const week = getActiveWeek();
  if (!week)
    return {
      top3: [],
      myRank: null,
      totalTraders: 0,
      gapToTop: null,
      gapToNext: null,
    };

  const rows = db
    .select({
      traderId: schema.balances.traderId,
      displayName: schema.traders.displayName,
      points: schema.balances.points,
    })
    .from(schema.balances)
    .innerJoin(schema.traders, eq(schema.balances.traderId, schema.traders.id))
    .where(eq(schema.balances.weekId, week.id))
    .orderBy(desc(schema.balances.points))
    .all();

  const top3 = rows.slice(0, 3).map((r, i) => ({
    rank: i + 1,
    displayName: r.displayName,
    points: r.points,
  }));

  let myRank: number | null = null;
  let gapToTop: number | null = null;
  let gapToNext: number | null = null;

  if (myTraderId !== undefined) {
    const idx = rows.findIndex((r) => r.traderId === myTraderId);
    if (idx >= 0) {
      myRank = idx + 1;
      if (idx > 0) {
        gapToTop = rows[0].points - rows[idx].points;
        gapToNext = rows[idx - 1].points - rows[idx].points;
      }
    }
  }

  return { top3, myRank, totalTraders: rows.length, gapToTop, gapToNext };
}
