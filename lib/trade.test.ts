import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
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

function seedWeek(db: BetterSQLite3Database<typeof schema>) {
  const week = db
    .insert(schema.weeks)
    .values({ startedAt: new Date(), isActive: true })
    .returning()
    .get();
  return week;
}

function seedTrader(
  db: BetterSQLite3Database<typeof schema>,
  weekId: number,
  opts: { sub: string; name: string; balance: number },
) {
  const trader = db
    .insert(schema.traders)
    .values({ sub: opts.sub, displayName: opts.name })
    .returning()
    .get();
  db.insert(schema.balances)
    .values({ weekId, traderId: trader.id, points: opts.balance })
    .run();
  return trader;
}

function seedTicker(
  db: BetterSQLite3Database<typeof schema>,
  weekId: number,
  name: string,
) {
  const ticker = db.insert(schema.tickers).values({ name }).returning().get();
  db.insert(schema.tickerStates)
    .values({ weekId, tickerId: ticker.id, outstandingShares: 0 })
    .run();
  return ticker;
}

describe("executeTrade — buy", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let weekId: number;
  let traderId: number;
  let tickerId: number;

  beforeEach(() => {
    db = setupDb();
    const week = seedWeek(db);
    weekId = week.id;
    const trader = seedTrader(db, weekId, { sub: "a", name: "Alice", balance: 1000 });
    traderId = trader.id;
    const ticker = seedTicker(db, weekId, "$TEST");
    tickerId = ticker.id;
  });

  it("buys 1 share at s=0 for 101 points", () => {
    const r = executeTrade({ traderId, tickerId, shares: 1, side: "buy" }, db);
    expect(r.pointsAmount).toBe(101);
    expect(r.newBalance).toBe(899);
    expect(r.newOutstandingShares).toBe(1);
    expect(r.newHolding).toBe(1);
  });

  it("buys 5 shares for 525 points", () => {
    const r = executeTrade({ traderId, tickerId, shares: 5, side: "buy" }, db);
    expect(r.pointsAmount).toBe(525);
    expect(r.newBalance).toBe(475);
    expect(r.newOutstandingShares).toBe(5);
  });

  it("rejects buy with insufficient balance", () => {
    expect(() =>
      executeTrade({ traderId, tickerId, shares: 100, side: "buy" }, db),
    ).toThrow(TradeError);
  });

  it("accumulates holdings across multiple buys", () => {
    executeTrade({ traderId, tickerId, shares: 2, side: "buy" }, db);
    const r2 = executeTrade({ traderId, tickerId, shares: 3, side: "buy" }, db);
    expect(r2.newOutstandingShares).toBe(5);
    expect(r2.newHolding).toBe(5);
    expect(r2.newBalance).toBe(1000 - 525); // cumulative = buy(0,5)
  });
});

describe("executeTrade — sell", () => {
  let db: BetterSQLite3Database<typeof schema>;
  let weekId: number;
  let traderId: number;
  let tickerId: number;

  beforeEach(() => {
    db = setupDb();
    const week = seedWeek(db);
    weekId = week.id;
    const trader = seedTrader(db, weekId, { sub: "a", name: "Alice", balance: 1000 });
    traderId = trader.id;
    const ticker = seedTicker(db, weekId, "$TEST");
    tickerId = ticker.id;
    executeTrade({ traderId, tickerId, shares: 5, side: "buy" }, db);
  });

  it("sells back the same shares for the same total (zero round-trip)", () => {
    const r = executeTrade({ traderId, tickerId, shares: 5, side: "sell" }, db);
    expect(r.pointsAmount).toBe(525);
    expect(r.newBalance).toBe(1000);
    expect(r.newOutstandingShares).toBe(0);
    expect(r.newHolding).toBe(0);
  });

  it("rejects sell beyond holdings", () => {
    expect(() =>
      executeTrade({ traderId, tickerId, shares: 6, side: "sell" }, db),
    ).toThrow(TradeError);
  });

  it("partial sell updates state correctly", () => {
    const r = executeTrade({ traderId, tickerId, shares: 2, side: "sell" }, db);
    // After buy 5: s=5. Sell 2: integral from 3 to 5 = 107 + 109 = 216
    expect(r.pointsAmount).toBe(216);
    expect(r.newOutstandingShares).toBe(3);
    expect(r.newHolding).toBe(3);
    expect(r.newBalance).toBe(475 + 216);
  });
});

describe("executeTrade — interleaved traders (zero-sum check)", () => {
  it("two traders' buy + sell sequence preserves total points (excluding pool)", () => {
    const db = setupDb();
    const week = seedWeek(db);
    const a = seedTrader(db, week.id, { sub: "a", name: "Alice", balance: 1000 });
    const b = seedTrader(db, week.id, { sub: "b", name: "Bob", balance: 1000 });
    const ticker = seedTicker(db, week.id, "$Z");

    // A buys 5, B buys 3, B sells 3, A sells 5 → all back to baseline (matches bonding curve test)
    executeTrade({ traderId: a.id, tickerId: ticker.id, shares: 5, side: "buy" }, db);
    executeTrade({ traderId: b.id, tickerId: ticker.id, shares: 3, side: "buy" }, db);
    executeTrade({ traderId: b.id, tickerId: ticker.id, shares: 3, side: "sell" }, db);
    const final = executeTrade(
      { traderId: a.id, tickerId: ticker.id, shares: 5, side: "sell" },
      db,
    );

    expect(final.newOutstandingShares).toBe(0);
    expect(final.newBalance).toBe(1000); // A back to start

    const bRow = db
      .select()
      .from(schema.balances)
      .all()
      .find((r) => r.traderId === b.id);
    expect(bRow?.points).toBe(1000); // B back to start
  });
});
