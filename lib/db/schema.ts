import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const weeks = sqliteTable("weeks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const traders = sqliteTable(
  "traders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sub: text("sub").notNull(),
    displayName: text("display_name").notNull(),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** NULL = 온보딩 미완료 (닉네임 확인 필요) */
    onboardedAt: integer("onboarded_at", { mode: "timestamp" }),
    /** 마지막 월급 입금 시각. 같은 YYYY-MM이면 이번 달 분은 이미 받은 것으로 간주 */
    lastSalaryAt: integer("last_salary_at", { mode: "timestamp" }),
  },
  (t) => [
    uniqueIndex("traders_sub_idx").on(t.sub),
    uniqueIndex("traders_display_name_idx").on(t.displayName),
  ],
);

export const tickers = sqliteTable(
  "tickers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("tickers_name_idx").on(t.name)],
);

export const balances = sqliteTable(
  "balances",
  {
    weekId: integer("week_id")
      .notNull()
      .references(() => weeks.id),
    traderId: integer("trader_id")
      .notNull()
      .references(() => traders.id),
    points: integer("points").notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.traderId] })],
);

export const tickerStates = sqliteTable(
  "ticker_states",
  {
    weekId: integer("week_id")
      .notNull()
      .references(() => weeks.id),
    tickerId: integer("ticker_id")
      .notNull()
      .references(() => tickers.id),
    outstandingShares: integer("outstanding_shares").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.tickerId] })],
);

export const holdings = sqliteTable(
  "holdings",
  {
    weekId: integer("week_id")
      .notNull()
      .references(() => weeks.id),
    traderId: integer("trader_id")
      .notNull()
      .references(() => traders.id),
    tickerId: integer("ticker_id")
      .notNull()
      .references(() => tickers.id),
    shares: integer("shares").notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.traderId, t.tickerId] })],
);

/**
 * 잔고 변동 ledger. 매수/매도/청산/월급/라운드 리셋 등 모든 변동을 기록.
 * trades 테이블과 부분적으로 중복이지만, ledger는 잔고 흐름 추적이 목적이라
 * 각 변동의 delta + balance_after를 명시적으로 박아둠.
 */
export const balanceEvents = sqliteTable("balance_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  traderId: integer("trader_id")
    .notNull()
    .references(() => traders.id),
  weekId: integer("week_id").references(() => weeks.id),
  tickerId: integer("ticker_id").references(() => tickers.id),
  /** 양수면 입금, 음수면 출금 */
  delta: integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  type: text("type", {
    enum: [
      "buy",
      "sell",
      "liquidation",
      "salary",
      "init",
      "round_reset",
      "gift",
    ],
  }).notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeks.id),
  traderId: integer("trader_id")
    .notNull()
    .references(() => traders.id),
  tickerId: integer("ticker_id")
    .notNull()
    .references(() => tickers.id),
  side: text("side", { enum: ["buy", "sell", "liquidation"] }).notNull(),
  shares: integer("shares").notNull(),
  points: integer("points").notNull(),
  executedAt: integer("executed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Trader = typeof traders.$inferSelect;
export type Ticker = typeof tickers.$inferSelect;
export type Week = typeof weeks.$inferSelect;
export type Balance = typeof balances.$inferSelect;
export type TickerState = typeof tickerStates.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type BalanceEvent = typeof balanceEvents.$inferSelect;
