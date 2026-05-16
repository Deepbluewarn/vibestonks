/**
 * 금요일 17:00 cron 진입점 — 수동 실행도 가능.
 */
import { liquidate } from "../lib/cycle";

const r = liquidate();
console.log(`✓ Week ${r.weekId} 청산 완료`);
console.log(`  포지션 ${r.lines.length}건 청산, 지급액 합 ${r.totalPaidOut} 포인트`);
console.log(`  시스템 보조금: ${r.subsidy} 포인트`);
