import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  getAdminStats,
  getAllTraders,
  getCurrentTickers,
} from "@/lib/queries";
import { AdminActions } from "./admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.traderId || !session.user.isAdmin) notFound();

  const stats = getAdminStats();
  const traders = getAllTraders();
  const tickers = getCurrentTickers();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← 대시보드
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          관리자
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          시스템 운영 도구. 신중하게 사용하세요.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="활성 라운드" value={stats.activeWeek ? `Week ${stats.activeWeek.id}` : "없음"} />
        <Stat
          label="경과"
          value={
            stats.activeWeek
              ? humanDuration(Date.now() - stats.activeWeek.startedAt)
              : "—"
          }
        />
        <Stat label="트레이더" value={`${stats.totalTraders}명`} />
        <Stat label="총 거래" value={`${stats.totalTrades}건`} />
        <Stat label="발행 주식 합" value={`${stats.totalOutstandingShares}주`} />
        <Stat label="풀 잔액" value={`${stats.poolBalance}pt`} />
        <Stat
          label="누적 보조금"
          value={`${stats.cumulativeSubsidy}pt`}
          hint="청산 지급액 − 풀이 모은 포인트"
        />
        <Stat label="종목 (글로벌)" value={`${stats.totalTickers}개`} />
      </section>

      <AdminActions
        hasActiveWeek={stats.activeWeek !== null}
        tickers={tickers.map((t) => ({ id: t.id, name: t.name }))}
        traders={traders.map((t) => ({
          id: t.id,
          displayName: t.displayName,
          sub: t.sub,
          isAdmin: t.isAdmin,
          currentBalance: t.currentBalance,
        }))}
        currentAdminTraderId={session.user.traderId}
        botStatus={stats.botStatus}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      title={hint}
      className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value}
      </p>
    </div>
  );
}

function humanDuration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분`;
  const d = Math.floor(h / 24);
  return `${d}일 ${h % 24}시간`;
}
