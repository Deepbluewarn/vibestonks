import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { buyCost, currentPrice, sellReceipt } from "./bonding-curve";
import { db as defaultDb, schema } from "./db";
import { publish } from "./events";

export type TradeSide = "buy" | "sell";

export class TradeError extends Error {
  constructor(
    public readonly code:
      | "no_active_week"
      | "ticker_not_in_week"
      | "insufficient_balance"
      | "insufficient_shares"
      | "invalid_shares",
    message: string,
  ) {
    super(message);
    this.name = "TradeError";
  }
}

export interface TradeResult {
  side: TradeSide;
  shares: number;
  /** Points paid (buy) or received (sell). Always positive. */
  pointsAmount: number;
  /** Trader's balance after the trade. */
  newBalance: number;
  /** Ticker's outstanding shares after the trade. */
  newOutstandingShares: number;
  /** Trader's holdings of this ticker after the trade. */
  newHolding: number;
  tradeId: number;
}

/**
 * Execute a single atomic trade.
 *
 * Wraps the read-modify-write cycle in a SQLite transaction; better-sqlite3 serializes
 * writes per-connection, and BEGIN IMMEDIATE inside drizzle's tx ensures we hold the
 * write lock for the duration. Two concurrent calls to executeTrade cannot interleave.
 */
export function executeTrade(
  args: {
    traderId: number;
    tickerId: number;
    shares: number;
    side: TradeSide;
  },
  database: BetterSQLite3Database<typeof schema> = defaultDb,
): TradeResult {
  const { traderId, tickerId, shares, side } = args;

  if (!Number.isInteger(shares) || shares <= 0) {
    throw new TradeError("invalid_shares", `shares must be positive integer, got ${shares}`);
  }

  const result = database.transaction((tx) => {
    const activeWeek = tx
      .select()
      .from(schema.weeks)
      .where(eq(schema.weeks.isActive, true))
      .get();

    if (!activeWeek) {
      throw new TradeError("no_active_week", "no active week");
    }

    const tickerState = tx
      .select()
      .from(schema.tickerStates)
      .where(
        and(
          eq(schema.tickerStates.weekId, activeWeek.id),
          eq(schema.tickerStates.tickerId, tickerId),
        ),
      )
      .get();

    if (!tickerState) {
      throw new TradeError(
        "ticker_not_in_week",
        `ticker ${tickerId} not initialized for week ${activeWeek.id}`,
      );
    }

    const balanceRow = tx
      .select()
      .from(schema.balances)
      .where(
        and(
          eq(schema.balances.weekId, activeWeek.id),
          eq(schema.balances.traderId, traderId),
        ),
      )
      .get();

    if (!balanceRow) {
      throw new TradeError(
        "no_active_week",
        `trader ${traderId} has no balance for week ${activeWeek.id}`,
      );
    }

    const holdingRow = tx
      .select()
      .from(schema.holdings)
      .where(
        and(
          eq(schema.holdings.weekId, activeWeek.id),
          eq(schema.holdings.traderId, traderId),
          eq(schema.holdings.tickerId, tickerId),
        ),
      )
      .get();

    const currentHolding = holdingRow?.shares ?? 0;
    const currentOutstanding = tickerState.outstandingShares;
    const currentBalance = balanceRow.points;

    let pointsAmount: number;
    let newBalance: number;
    let newOutstanding: number;
    let newHolding: number;

    if (side === "buy") {
      pointsAmount = buyCost(currentOutstanding, shares);
      if (pointsAmount > currentBalance) {
        throw new TradeError(
          "insufficient_balance",
          `need ${pointsAmount} points, have ${currentBalance}`,
        );
      }
      newBalance = currentBalance - pointsAmount;
      newOutstanding = currentOutstanding + shares;
      newHolding = currentHolding + shares;
    } else {
      if (shares > currentHolding) {
        throw new TradeError(
          "insufficient_shares",
          `tried to sell ${shares}, hold ${currentHolding}`,
        );
      }
      pointsAmount = sellReceipt(currentOutstanding, shares);
      newBalance = currentBalance + pointsAmount;
      newOutstanding = currentOutstanding - shares;
      newHolding = currentHolding - shares;
    }

    tx.update(schema.balances)
      .set({ points: newBalance })
      .where(
        and(
          eq(schema.balances.weekId, activeWeek.id),
          eq(schema.balances.traderId, traderId),
        ),
      )
      .run();

    tx.update(schema.tickerStates)
      .set({ outstandingShares: newOutstanding })
      .where(
        and(
          eq(schema.tickerStates.weekId, activeWeek.id),
          eq(schema.tickerStates.tickerId, tickerId),
        ),
      )
      .run();

    if (holdingRow) {
      tx.update(schema.holdings)
        .set({ shares: newHolding })
        .where(
          and(
            eq(schema.holdings.weekId, activeWeek.id),
            eq(schema.holdings.traderId, traderId),
            eq(schema.holdings.tickerId, tickerId),
          ),
        )
        .run();
    } else {
      tx.insert(schema.holdings)
        .values({
          weekId: activeWeek.id,
          traderId,
          tickerId,
          shares: newHolding,
        })
        .run();
    }

    const inserted = tx
      .insert(schema.trades)
      .values({
        weekId: activeWeek.id,
        traderId,
        tickerId,
        side,
        shares,
        points: side === "buy" ? -pointsAmount : pointsAmount,
      })
      .returning({ id: schema.trades.id })
      .get();

    tx.insert(schema.balanceEvents)
      .values({
        traderId,
        weekId: activeWeek.id,
        tickerId,
        delta: side === "buy" ? -pointsAmount : pointsAmount,
        balanceAfter: newBalance,
        type: side,
      })
      .run();

    return {
      side,
      shares,
      pointsAmount,
      newBalance,
      newOutstandingShares: newOutstanding,
      newHolding,
      tradeId: inserted.id,
    };
  });

  publish({
    type: "trade",
    tickerId: args.tickerId,
    price: currentPrice(result.newOutstandingShares),
    outstandingShares: result.newOutstandingShares,
  });

  return result;
}
