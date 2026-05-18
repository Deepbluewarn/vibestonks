import { auth } from "@/auth";
import {
  getActiveWeek,
  getCurrentTickersWithHistory,
  getLeaderboard,
  getMyState,
} from "@/lib/queries";
import { LiveUpdater } from "./live-updater";
import { RoundStatus } from "./round-status";
import { TradeBoard } from "./trade-board";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const traderId = session?.user?.traderId;
  if (!traderId) return null;

  const tickers = getCurrentTickersWithHistory();
  const myState = getMyState(traderId);
  const leaderboard = getLeaderboard(traderId);
  const activeWeek = getActiveWeek();

  if (!myState) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800 dark:border-yellow-800/50 dark:bg-yellow-900/30 dark:text-yellow-200">
        활성 주차가 없습니다. 관리자가 <code>npm run cycle:reset</code>으로 새
        주차를 시작해야 거래가 가능합니다.
      </div>
    );
  }

  const salaryThisWeek = isSalaryThisWeek(session.user.lastSalaryAt ?? null);
  const justCredited = session.user.salaryJustCredited === true;

  return (
    <div className="space-y-8">
      <LiveUpdater />
      {justCredited && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          💰 <span className="font-semibold">이번 주 주급 1,000pt</span>가 잔고에
          입금되었습니다.
        </div>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            antstock
          </h1>
          {activeWeek && (
            <RoundStatus
              roundId={activeWeek.id}
              startedAtMs={activeWeek.startedAt.getTime()}
            />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <RoundReturn
            balance={myState.balance}
            portfolioValue={myState.portfolioValue}
          />
          {salaryThisWeek && !justCredited && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              💰 이번 주 주급 입금 완료
            </p>
          )}
        </div>
      </header>

      <TradeBoard
        tickers={tickers}
        holdings={myState.holdings}
        balance={myState.balance}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300">
          이번 주 상위
        </h2>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {leaderboard.top3.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">
              아직 데이터 없음
            </p>
          ) : (
            leaderboard.top3.map((e) => (
              <div
                key={e.rank}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400 dark:text-gray-500">
                    {e.rank}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {e.displayName}
                  </span>
                </span>
                <span className="tabular-nums text-gray-700 dark:text-gray-300">
                  {e.points}pt
                </span>
              </div>
            ))
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
            <span>
              내 등수:{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {leaderboard.myRank
                  ? `${leaderboard.myRank} / ${leaderboard.totalTraders}`
                  : "—"}
              </span>
            </span>
            {leaderboard.gapToNext !== null && (
              <span className="tabular-nums">
                바로 위까지 -{leaderboard.gapToNext}pt
                {leaderboard.gapToTop !== null &&
                  leaderboard.gapToTop !== leaderboard.gapToNext && (
                    <span className="ml-2 text-gray-400 dark:text-gray-500">
                      · 1위까지 -{leaderboard.gapToTop}pt
                    </span>
                  )}
              </span>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}

function isSalaryThisWeek(iso: string | null): boolean {
  if (!iso) return false;
  return weekKey(new Date(iso)) === weekKey(new Date());
}

function weekKey(d: Date): string {
  const monday = new Date(d.getTime());
  const day = monday.getUTCDay();
  const diff = (day + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function RoundReturn({
  balance,
  portfolioValue,
}: {
  balance: number;
  portfolioValue: number;
}) {
  const SEED = 1000;
  const delta = portfolioValue - SEED;
  const pct = (delta / SEED) * 100;
  const color =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-gray-500 dark:text-gray-400";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        이번 라운드 수익
      </p>
      <p className={`text-3xl font-bold leading-none tabular-nums ${color}`}>
        {arrow} {delta >= 0 ? "+" : ""}
        {delta}
        <span className="ml-1 text-base text-gray-400 dark:text-gray-500">
          pt
        </span>
      </p>
      <p className={`mt-1 text-sm font-medium tabular-nums ${color}`}>
        {pct >= 0 ? "+" : ""}
        {pct.toFixed(1)}%
      </p>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
        현금 {balance}pt · 평가 {portfolioValue}pt
      </p>
    </div>
  );
}
