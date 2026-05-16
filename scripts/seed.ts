/**
 * 초기 시드: 1주차 + 랜덤 5개 종목 + 개발용 트레이더(Alice).
 *
 * 사용:
 *   npm run db:reset      # .data 삭제 + migrate + seed
 *   npm run db:seed       # seed만 (마이그레이션은 이미 됐다고 가정)
 *
 * 멱등 아님 — 이미 active week 있으면 중단.
 */
import { db, schema } from "../lib/db";
import { CONCEPT_NAMES, pickRandomTickers } from "../lib/seed-data/concepts";

const SEED_POINTS = 1000;
const TICKER_COUNT = 5;
const DEV_TRADER_SUB = "dev:alice";
const DEV_TRADER_NAME = "Alice";

function main() {
  const existingWeeks = db.select().from(schema.weeks).all();
  if (existingWeeks.length > 0) {
    console.error(
      `DB already has ${existingWeeks.length} week(s). Run \`npm run db:reset\` to start fresh.`,
    );
    process.exit(1);
  }

  const week = db
    .insert(schema.weeks)
    .values({ startedAt: new Date(), isActive: true })
    .returning()
    .get();

  const picks = pickRandomTickers(TICKER_COUNT);
  for (const name of picks) {
    const ticker = db.insert(schema.tickers).values({ name }).returning().get();
    db.insert(schema.tickerStates)
      .values({ weekId: week.id, tickerId: ticker.id, outstandingShares: 0 })
      .run();
  }

  const alice = db
    .insert(schema.traders)
    .values({
      sub: DEV_TRADER_SUB,
      displayName: DEV_TRADER_NAME,
      isAdmin: true,
      onboardedAt: new Date(),
    })
    .returning()
    .get();
  db.insert(schema.balances)
    .values({ weekId: week.id, traderId: alice.id, points: SEED_POINTS })
    .run();

  console.log(`✓ Week ${week.id} (active)`);
  console.log(`✓ Tickers (${picks.length}/${CONCEPT_NAMES.length} 풀에서 랜덤):`);
  for (const name of picks) console.log(`    - ${name}`);
  console.log(`✓ Dev trader: ${DEV_TRADER_NAME} (sub=${DEV_TRADER_SUB}, admin)`);
  console.log(`✓ Balance: ${SEED_POINTS} points`);
}

main();
