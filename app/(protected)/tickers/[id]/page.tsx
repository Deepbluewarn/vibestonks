import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { LiveUpdater } from "@/app/(protected)/dashboard/live-updater";
import { getMyState, getTickerDetail } from "@/lib/queries";
import { ChartWithAxes } from "./chart-with-axes";
import { TickerActions } from "./ticker-actions";

export const dynamic = "force-dynamic";

export default async function TickerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tickerId = Number(id);
  if (!Number.isInteger(tickerId)) notFound();

  const session = await auth();
  const traderId = session?.user?.traderId;
  if (!traderId) return null;

  const detail = getTickerDetail(tickerId, traderId);
  if (!detail) notFound();

  const myState = getMyState(traderId);
  const balance = myState?.balance ?? 0;

  const change = detail.price - 100;
  const pct = change === 0 ? 0 : (change / 100) * 100;
  const trend =
    change > 0
      ? { color: "text-emerald-600 dark:text-emerald-400", arrow: "▲" }
      : change < 0
        ? { color: "text-rose-600 dark:text-rose-400", arrow: "▼" }
        : { color: "text-gray-400 dark:text-gray-500", arrow: "·" };

  return (
    <div className="space-y-6">
      <LiveUpdater />

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← 대시보드
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-50">
            {detail.name}
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            발행 {detail.outstandingShares} · 내 보유 {detail.myShares}
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold leading-none tabular-nums text-gray-900 dark:text-gray-50">
            {detail.price}
            <span className="ml-1 text-base text-gray-400 dark:text-gray-500">
              pt
            </span>
          </div>
          <div className={`mt-1 text-sm font-medium tabular-nums ${trend.color}`}>
            {trend.arrow} {pct > 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </div>
        </div>
      </header>

      <ChartWithAxes history={detail.history} />

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
          거래
        </h2>
        <TickerActions
          tickerId={detail.id}
          outstandingShares={detail.outstandingShares}
          balance={balance}
          myShares={detail.myShares}
        />
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          현금 잔고 {balance}pt
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-medium uppercase tracking-wide text-gray-600 dark:border-gray-800 dark:text-gray-400">
          최근 거래
        </h2>
        {detail.recentTrades.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            아직 거래가 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {detail.recentTrades.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 text-center text-[11px] font-medium ${
                      t.side === "buy"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                    }`}
                  >
                    {t.side === "buy" ? "매수" : "매도"}
                  </span>
                  <span className="tabular-nums text-gray-800 dark:text-gray-200">
                    {t.shares}주 · {t.pointsAbs}pt
                  </span>
                  {t.isMe && (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      나
                    </span>
                  )}
                </span>
                <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                  {formatRelative(t.executedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}
