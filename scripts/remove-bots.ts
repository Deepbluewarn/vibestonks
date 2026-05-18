/**
 * 봇 트레이더 일괄 제거.
 *
 * sub LIKE 'bot:%' 인 트레이더와 그에 딸린 모든 데이터를 삭제.
 * 외래 키 순서대로: trades → balance_events → holdings → balances → traders.
 *
 * 사용:
 *   npm run bots:remove           # 미리보기 (count만)
 *   npm run bots:remove -- --yes  # 실제 삭제
 *
 * 주의: 봇 거래 이력도 같이 지워지므로 다른 트레이더의 차트/가격에는
 * 영향 없음(가격은 현재 outstanding_shares에서 도출). 다만 거래 이력
 * 차트는 봇 거래가 빠진 상태로 재구성됨.
 */
import { inArray, like } from "drizzle-orm";
import { db, schema } from "../lib/db";

const yes = process.argv.includes("--yes") || process.argv.includes("-y");

const bots = db
  .select({ id: schema.traders.id, sub: schema.traders.sub, displayName: schema.traders.displayName })
  .from(schema.traders)
  .where(like(schema.traders.sub, "bot:%"))
  .all();

if (bots.length === 0) {
  console.log("(봇 트레이더 없음)");
  process.exit(0);
}

const ids = bots.map((b) => b.id);

// 카운트 미리보기
const trades = db.select().from(schema.trades).where(inArray(schema.trades.traderId, ids)).all().length;
const events = db.select().from(schema.balanceEvents).where(inArray(schema.balanceEvents.traderId, ids)).all().length;
const holds = db.select().from(schema.holdings).where(inArray(schema.holdings.traderId, ids)).all().length;
const bals = db.select().from(schema.balances).where(inArray(schema.balances.traderId, ids)).all().length;

console.log(`봇 트레이더: ${bots.length}명`);
console.log(`  trades:         ${trades}건`);
console.log(`  balance_events: ${events}건`);
console.log(`  holdings:       ${holds}행`);
console.log(`  balances:       ${bals}행`);

if (!yes) {
  console.log("\n실제로 지우려면 --yes 플래그 추가:");
  console.log("  npm run bots:remove -- --yes");
  process.exit(0);
}

console.log("\n→ 삭제 중...");
db.transaction((tx) => {
  tx.delete(schema.trades).where(inArray(schema.trades.traderId, ids)).run();
  tx.delete(schema.balanceEvents).where(inArray(schema.balanceEvents.traderId, ids)).run();
  tx.delete(schema.holdings).where(inArray(schema.holdings.traderId, ids)).run();
  tx.delete(schema.balances).where(inArray(schema.balances.traderId, ids)).run();
  tx.delete(schema.traders).where(inArray(schema.traders.id, ids)).run();
});
console.log(`✓ ${bots.length}명의 봇 + 관련 데이터 삭제 완료`);
