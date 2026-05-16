/**
 * 검증용 one-off: Alice가 첫 번째 종목 5주 매수.
 */
import { db, schema } from "../lib/db";
import { executeTrade } from "../lib/trade";

const alice = db
  .select()
  .from(schema.traders)
  .all()
  .find((t) => t.sub === "dev:alice");
if (!alice) throw new Error("Alice not seeded");

const tickers = db.select().from(schema.tickers).all();
const tk = tickers[0];

const r = executeTrade({
  traderId: alice.id,
  tickerId: tk.id,
  shares: 5,
  side: "buy",
});
console.log(`✓ Alice가 ${tk.name} 5주 매수 → ${r.pointsAmount}pt 차감`);
console.log(`  잔고: ${r.newBalance}, 보유: ${r.newHolding}, 발행: ${r.newOutstandingShares}`);
