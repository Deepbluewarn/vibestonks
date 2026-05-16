/**
 * 월요일 09:00 cron 진입점 — 수동 실행도 가능.
 */
import { hardReset } from "../lib/cycle";

const r = hardReset();
console.log(`✓ Week ${r.weekId} 시작 (이전: ${r.previousWeekId ?? "없음"})`);
console.log(`✓ 종목: ${r.tickers.join(", ")}`);
console.log(`✓ 트레이더 ${r.tradersUpdated}명 잔고 1000으로 리셋`);
