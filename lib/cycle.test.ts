import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CycleError, hardReset, liquidate } from "./cycle";
import * as schema from "./db/schema";
import { TradeError, executeTrade } from "./trade";

function setupDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const migrationsDir = path.resolve(__dirname, "db/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }
  return drizzle(sqlite, { schema });
}

function seedTrader(
  db: BetterSQLite3Database<typeof schema>,
  sub: string,
  name: string,
) {
  return db.insert(schema.traders).values({ sub, displayName: name }).returning().get();
}

describe("hardReset", () => {
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    db = setupDb();
  });

  it("creates week 1 with 5 random tickers and credits all traders", () => {
    const alice = seedTrader(db, "a", "Alice");
    const bob = seedTrader(db, "b", "Bob");

    const r = hardReset(db);

    expect(r.weekId).toBeGreaterThan(0);
    expect(r.previousWeekId).toBeNull();
    expect(r.tickers).toHaveLength(5);
    expect(new Set(r.tickers).size).toBe(5); // unique
    expect(r.tradersUpdated).toBe(2);

    const balances = db.select().from(schema.balances).all();
    expect(balances).toHaveLength(2);
    expect(balances.every((b) => b.points === 1000)).toBe(true);

    const states = db.select().from(schema.tickerStates).all();
    expect(states).toHaveLength(5);
    expect(states.every((s) => s.outstandingShares === 0)).toBe(true);
  });

  it("ends the previous week when a new one starts", () => {
    seedTrader(db, "a", "Alice");
    const r1 = hardReset(db);
    const r2 = hardReset(db);

    expect(r2.previousWeekId).toBe(r1.weekId);
    expect(r2.weekId).not.toBe(r1.weekId);

    const weeks = db.select().from(schema.weeks).all();
    expect(weeks.find((w) => w.id === r1.weekId)?.isActive).toBe(false);
    expect(weeks.find((w) => w.id === r2.weekId)?.isActive).toBe(true);
  });

  it("creates per-week ticker_state rows even when ticker name is reused", () => {
    seedTrader(db, "a", "Alice");
    hardReset(db);
    const tickersAfterFirst = db.select().from(schema.tickers).all().length;
    hardReset(db);
    const tickersAfterSecond = db.select().from(schema.tickers).all().length;

    // 두 주차 합쳐서 최대 10개 ticker (겹치면 더 적음). 무조건 첫 주차보다 많거나 같음.
    expect(tickersAfterSecond).toBeGreaterThanOrEqual(tickersAfterFirst);

    const week2 = db.select().from(schema.weeks).all().find((w) => w.isActive);
    const week2States = db
      .select()
      .from(schema.tickerStates)
      .all()
      .filter((s) => s.weekId === week2!.id);
    expect(week2States).toHaveLength(5);
  });
});

describe("liquidate", () => {
  let db: BetterSQLite3Database<typeof schema>;

  beforeEach(() => {
    db = setupDb();
  });

  it("converts holdings to mark-to-market balance and records liquidation trades", () => {
    seedTrader(db, "a", "Alice");
    hardReset(db);

    const alice = db.select().from(schema.traders).all()[0];
    const ticker = db.select().from(schema.tickers).all()[0];

    executeTrade({ traderId: alice.id, tickerId: ticker.id, shares: 5, side: "buy" }, db);
    // After buy 5: balance = 1000 - 525 = 475, outstanding = 5, price = 110
    // Liquidate: 5 × 110 = 550 added → balance = 1025

    const r = liquidate(db);

    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].pointsCredited).toBe(550);
    expect(r.totalPaidOut).toBe(550);
    expect(r.subsidy).toBe(550 - 525); // 25 보조금

    const balance = db.select().from(schema.balances).all()[0];
    expect(balance.points).toBe(1025);

    const holdings = db.select().from(schema.holdings).all();
    expect(holdings.every((h) => h.shares === 0)).toBe(true);

    const states = db.select().from(schema.tickerStates).all();
    expect(states.every((s) => s.outstandingShares === 0)).toBe(true);

    const liquidationTrades = db
      .select()
      .from(schema.trades)
      .all()
      .filter((t) => t.side === "liquidation");
    expect(liquidationTrades).toHaveLength(1);
    expect(liquidationTrades[0].shares).toBe(5);
    expect(liquidationTrades[0].points).toBe(550);
  });

  it("deactivates the week and blocks subsequent trades", () => {
    seedTrader(db, "a", "Alice");
    hardReset(db);
    liquidate(db);

    const alice = db.select().from(schema.traders).all()[0];
    const ticker = db.select().from(schema.tickers).all()[0];

    expect(() =>
      executeTrade({ traderId: alice.id, tickerId: ticker.id, shares: 1, side: "buy" }, db),
    ).toThrow(TradeError);
  });

  it("reproduces ADR-0004 subsidy example (A 5주 + B 3주 → 64포인트 보조금)", () => {
    seedTrader(db, "a", "Alice");
    seedTrader(db, "b", "Bob");
    hardReset(db);

    const traders = db.select().from(schema.traders).all();
    const alice = traders[0];
    const bob = traders[1];
    const ticker = db.select().from(schema.tickers).all()[0];

    executeTrade({ traderId: alice.id, tickerId: ticker.id, shares: 5, side: "buy" }, db);
    executeTrade({ traderId: bob.id, tickerId: ticker.id, shares: 3, side: "buy" }, db);
    // 풀: 525 + 339 = 864. 마감가: 100 + 2*8 = 116.
    // A 청산: 5 × 116 = 580. B 청산: 3 × 116 = 348. 총 지급: 928. 보조금: 64.

    const r = liquidate(db);
    expect(r.totalPaidOut).toBe(928);
    expect(r.subsidy).toBe(64);
  });

  it("throws if no active week", () => {
    expect(() => liquidate(db)).toThrow(CycleError);
  });
});

describe("full cycle integration", () => {
  it("week 1 → 거래 → 청산 → week 2 리셋 → 잔고 1000 회복", () => {
    const db = setupDb();
    seedTrader(db, "a", "Alice");

    // Week 1
    hardReset(db);
    const alice = db.select().from(schema.traders).all()[0];
    const tk1 = db.select().from(schema.tickers).all()[0];
    executeTrade({ traderId: alice.id, tickerId: tk1.id, shares: 3, side: "buy" }, db);
    liquidate(db);

    const week1Balance = db.select().from(schema.balances).all().find((b) =>
      b.traderId === alice.id,
    );
    expect(week1Balance!.points).toBeGreaterThan(1000); // 보조금으로 인해 +α

    // Week 2 — 다시 1000으로 리셋
    hardReset(db);
    const activeWeek = db.select().from(schema.weeks).all().find((w) => w.isActive);
    const week2Balance = db
      .select()
      .from(schema.balances)
      .all()
      .find((b) => b.weekId === activeWeek!.id && b.traderId === alice.id);
    expect(week2Balance!.points).toBe(1000);
  });
});
