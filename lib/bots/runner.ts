/**
 * 봇 트레이더 시뮬레이터 — 6가지 페르소나 믹스.
 *
 * 페르소나 분포:
 *   30% Momentum  — 가격 오르는 종목 따라 사기
 *   20% MeanRevert — 떨어진 종목 사기, 많이 오른 종목 팔기
 *    5% Whale     — 가끔 대량(10~30주) 거래
 *   15% HODL      — 한 번 사고 거의 안 팜
 *   20% Scalper   — 짧은 간격으로 1주씩 사고팔기
 *   10% Newbie    — FOMO 편향, 무작정 매수 비중 높음
 *
 * 활성화:
 *   - boot 시 BOT_ENABLED=true 면 자동 시작 (instrumentation.ts)
 *   - 런타임에 /admin 또는 startBots()/stopBots()로 제어 가능
 *
 * 속도:
 *   - speed 1.0 = 기본 (페르소나별 tick 주기 그대로)
 *   - speed 10.0 = 10배 빠름 (모든 tick 주기를 1/10로)
 *   - 너무 빠르면 rate limit(트레이더당 10초/15회)에 걸려 거래 일부 거부됨
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { executeTrade } from "@/lib/trade";
import { BOT_NAMES } from "./names";

const SUB_PREFIX = "bot:";
const INITIAL_BALANCE = 1000;
const MIN_TICK_MS = 100; // 속도 무한정 빨라지지 않도록 하한
const SNAPSHOT_TTL_MS = 30_000;

type Personality = "momentum" | "meanRevert" | "whale" | "hodl" | "scalper" | "newbie";

const PERSONALITY_TICK: Record<Personality, [number, number]> = {
  momentum:   [15_000, 45_000],
  meanRevert: [15_000, 45_000],
  whale:      [120_000, 300_000],
  hodl:       [60_000, 300_000],
  scalper:    [5_000, 15_000],
  newbie:     [10_000, 30_000],
};

interface BotState {
  running: boolean;
  count: number;
  speed: number;
  timers: Set<ReturnType<typeof setTimeout>>;
}

const globalForBots = globalThis as unknown as {
  __antstockBotState?: BotState;
};

function getState(): BotState {
  if (!globalForBots.__antstockBotState) {
    globalForBots.__antstockBotState = {
      running: false,
      count: 0,
      speed: 1,
      timers: new Set(),
    };
  }
  return globalForBots.__antstockBotState;
}

export function getBotStatus(): { running: boolean; count: number; speed: number } {
  const s = getState();
  return { running: s.running, count: s.count, speed: s.speed };
}

export function startBots(opts: { count?: number; speed?: number } = {}): void {
  const state = getState();
  if (state.running) stopBots();

  state.count = opts.count ?? state.count ?? Number(process.env.BOT_COUNT ?? "100");
  state.speed = Math.max(0.1, opts.speed ?? state.speed ?? 1);
  state.running = true;

  console.log(`[bots] starting ${state.count} bots (speed ×${state.speed})`);
  const bots = ensureBots(state.count);
  for (const bot of bots) {
    scheduleBot(bot);
  }
  console.log(`[bots] ${bots.length} bots scheduled`);
}

export function stopBots(): void {
  const state = getState();
  state.running = false;
  for (const timer of state.timers) {
    clearTimeout(timer);
  }
  state.timers.clear();
  console.log("[bots] stopped");
}

interface Bot {
  traderId: number;
  personality: Personality;
}

function personalityFor(botIdx: number): Personality {
  const r = (botIdx * 2654435761) >>> 0;
  const bucket = r % 100;
  if (bucket < 30) return "momentum";
  if (bucket < 50) return "meanRevert";
  if (bucket < 55) return "whale";
  if (bucket < 70) return "hodl";
  if (bucket < 90) return "scalper";
  return "newbie";
}

function ensureBots(count: number): Bot[] {
  const result: Bot[] = [];
  for (let i = 1; i <= count; i++) {
    const sub = `${SUB_PREFIX}${i}`;
    let trader = db
      .select()
      .from(schema.traders)
      .where(eq(schema.traders.sub, sub))
      .get();

    if (!trader) {
      const baseName = BOT_NAMES[i % BOT_NAMES.length];
      let displayName = baseName;
      let suffix = 1;
      while (
        db
          .select()
          .from(schema.traders)
          .where(eq(schema.traders.displayName, displayName))
          .get()
      ) {
        suffix += 1;
        displayName = `${baseName}-${suffix}`;
      }
      trader = db
        .insert(schema.traders)
        .values({
          sub,
          displayName,
          isAdmin: false,
          onboardedAt: new Date(),
          lastSalaryAt: new Date(),
        })
        .returning()
        .get();
    }

    const activeWeek = db
      .select()
      .from(schema.weeks)
      .where(eq(schema.weeks.isActive, true))
      .get();
    if (activeWeek) {
      const bal = db
        .select()
        .from(schema.balances)
        .where(
          and(
            eq(schema.balances.weekId, activeWeek.id),
            eq(schema.balances.traderId, trader.id),
          ),
        )
        .get();
      if (!bal) {
        db.insert(schema.balances)
          .values({
            weekId: activeWeek.id,
            traderId: trader.id,
            points: INITIAL_BALANCE,
          })
          .run();
        db.insert(schema.balanceEvents)
          .values({
            traderId: trader.id,
            weekId: activeWeek.id,
            delta: INITIAL_BALANCE,
            balanceAfter: INITIAL_BALANCE,
            type: "init",
          })
          .run();
      }
    }

    result.push({ traderId: trader.id, personality: personalityFor(i) });
  }
  return result;
}

function scheduleBot(bot: Bot): void {
  const state = getState();
  if (!state.running) return;

  const [min, max] = PERSONALITY_TICK[bot.personality];
  const speed = Math.max(0.1, state.speed);
  const delay = Math.max(
    MIN_TICK_MS,
    Math.floor(randomBetween(min, max) / speed),
  );

  const t = setTimeout(() => {
    state.timers.delete(t);
    tick(bot).finally(() => scheduleBot(bot));
  }, delay);
  state.timers.add(t);
}

async function tick(bot: Bot): Promise<void> {
  try {
    const decision = decide(bot);
    if (!decision) return;
    executeTrade({
      traderId: bot.traderId,
      tickerId: decision.tickerId,
      shares: decision.shares,
      side: decision.side,
    });
  } catch {
    // silent — rate limit, 잔고 부족, 보유 부족 등은 정상 거부
  }
}

// ---- 시장 스냅샷 캐시 ----

interface TickerSnap {
  tickerId: number;
  outstanding: number;
  price: number;
  changePct: number;
}

let cachedSnapshot: { tickers: TickerSnap[]; at: number } | null = null;

function getMarket(): TickerSnap[] {
  if (cachedSnapshot && Date.now() - cachedSnapshot.at < SNAPSHOT_TTL_MS) {
    return cachedSnapshot.tickers;
  }
  const week = db
    .select()
    .from(schema.weeks)
    .where(eq(schema.weeks.isActive, true))
    .get();
  if (!week) {
    cachedSnapshot = { tickers: [], at: Date.now() };
    return [];
  }
  const states = db
    .select()
    .from(schema.tickerStates)
    .where(eq(schema.tickerStates.weekId, week.id))
    .all();
  const tickers = states.map((s) => {
    const price = 100 + 2 * s.outstandingShares;
    return {
      tickerId: s.tickerId,
      outstanding: s.outstandingShares,
      price,
      changePct: (price - 100) / 100,
    };
  });
  cachedSnapshot = { tickers, at: Date.now() };
  return tickers;
}

// ---- 의사결정 ----

interface Decision {
  tickerId: number;
  side: "buy" | "sell";
  shares: number;
}

function decide(bot: Bot): Decision | null {
  const market = getMarket();
  if (market.length === 0) return null;

  const week = db
    .select()
    .from(schema.weeks)
    .where(eq(schema.weeks.isActive, true))
    .get();
  if (!week) return null;

  const bal = db
    .select()
    .from(schema.balances)
    .where(
      and(
        eq(schema.balances.weekId, week.id),
        eq(schema.balances.traderId, bot.traderId),
      ),
    )
    .get();
  const balance = bal?.points ?? 0;

  const myHoldings = db
    .select()
    .from(schema.holdings)
    .where(
      and(
        eq(schema.holdings.weekId, week.id),
        eq(schema.holdings.traderId, bot.traderId),
      ),
    )
    .all()
    .filter((h) => h.shares > 0);

  switch (bot.personality) {
    case "momentum":   return decideMomentum(market, myHoldings, balance);
    case "meanRevert": return decideMeanRevert(market, myHoldings, balance);
    case "whale":      return decideWhale(market, myHoldings, balance);
    case "hodl":       return decideHodl(market, myHoldings, balance);
    case "scalper":    return decideScalper(market, myHoldings, balance);
    case "newbie":     return decideNewbie(market, myHoldings, balance);
  }
}

type Holding = { tickerId: number; shares: number };

function decideMomentum(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.2) return null;
  const ups = market.filter((m) => m.changePct > 0.05).sort((a, b) => b.changePct - a.changePct);
  const downs = market.filter((m) => m.changePct < -0.05);
  const heldDowns = holdings.filter((h) => downs.some((d) => d.tickerId === h.tickerId));

  if (heldDowns.length > 0 && Math.random() < 0.4) {
    const h = pick(heldDowns);
    return { tickerId: h.tickerId, side: "sell", shares: Math.min(h.shares, randInt(1, 3)) };
  }
  if (ups.length > 0) {
    const target = ups[0];
    const shares = randInt(1, 4);
    if (canBuy(target, shares, balance)) {
      return { tickerId: target.tickerId, side: "buy", shares };
    }
  }
  return null;
}

function decideMeanRevert(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.2) return null;
  const cheap = market.filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct);
  const overpriced = market.filter((m) => m.changePct > 0.3);
  const heldOverpriced = holdings.filter((h) => overpriced.some((o) => o.tickerId === h.tickerId));

  if (heldOverpriced.length > 0 && Math.random() < 0.6) {
    const h = pick(heldOverpriced);
    return { tickerId: h.tickerId, side: "sell", shares: Math.min(h.shares, randInt(1, 3)) };
  }
  const target = cheap[0] ?? pick(market);
  const shares = randInt(1, 3);
  if (canBuy(target, shares, balance)) {
    return { tickerId: target.tickerId, side: "buy", shares };
  }
  return null;
}

function decideWhale(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.3) return null;
  if (holdings.length > 0 && Math.random() < 0.4) {
    const h = pick(holdings);
    const shares = Math.max(1, Math.floor(h.shares * (0.5 + Math.random() * 0.5)));
    return { tickerId: h.tickerId, side: "sell", shares };
  }
  const target = pick(market);
  const shares = randInt(10, 30);
  if (canBuy(target, shares, balance)) {
    return { tickerId: target.tickerId, side: "buy", shares };
  }
  const fallback = randInt(3, 8);
  if (canBuy(target, fallback, balance)) {
    return { tickerId: target.tickerId, side: "buy", shares: fallback };
  }
  return null;
}

function decideHodl(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.95) return null;
  const target = pick(market);
  const shares = randInt(1, 5);
  if (canBuy(target, shares, balance)) {
    return { tickerId: target.tickerId, side: "buy", shares };
  }
  return null;
}

function decideScalper(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.15) return null;
  const buy = holdings.length === 0 || Math.random() < 0.5;
  if (buy) {
    const target = pick(market);
    if (canBuy(target, 1, balance)) {
      return { tickerId: target.tickerId, side: "buy", shares: 1 };
    }
  } else {
    const h = pick(holdings);
    return { tickerId: h.tickerId, side: "sell", shares: 1 };
  }
  return null;
}

function decideNewbie(market: TickerSnap[], holdings: Holding[], balance: number): Decision | null {
  if (Math.random() < 0.2) return null;
  const wantBuy = Math.random() < 0.7 || holdings.length === 0;
  if (wantBuy) {
    const ups = market.filter((m) => m.changePct > 0);
    const target = (ups.length > 0 && Math.random() < 0.8) ? pick(ups) : pick(market);
    const shares = randInt(1, 5);
    if (canBuy(target, shares, balance)) {
      return { tickerId: target.tickerId, side: "buy", shares };
    }
  } else {
    const h = pick(holdings);
    return { tickerId: h.tickerId, side: "sell", shares: Math.min(h.shares, randInt(1, 3)) };
  }
  return null;
}

// ---- 헬퍼 ----

function canBuy(t: TickerSnap, shares: number, balance: number): boolean {
  const cost = 100 * shares + 2 * t.outstanding * shares + shares * shares;
  return balance >= cost;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}
