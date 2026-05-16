import Link from "next/link";
import { auth } from "@/auth";
import {
  getMyBalanceHistory,
  type BalanceEventType,
  type BalanceHistoryEntry,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTERS: { key: string; label: string; types: BalanceEventType[] }[] = [
  { key: "all", label: "전체", types: [] },
  { key: "trade", label: "매수/매도", types: ["buy", "sell"] },
  { key: "salary", label: "월급", types: ["salary"] },
  { key: "round", label: "리셋/청산", types: ["round_reset", "liquidation", "init"] },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const session = await auth();
  const traderId = session?.user?.traderId;
  if (!traderId) return null;

  const params = await searchParams;
  const filterKey = params.filter ?? "all";
  const pageNum = Math.max(1, Number(params.page ?? "1") || 1);
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const { rows: events, total } = getMyBalanceHistory(traderId, {
    types: filter.types.length > 0 ? filter.types : undefined,
    limit: PAGE_SIZE,
    offset: (pageNum - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          내 잔고 기록
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          총 {total}건 · {pageNum} / {totalPages} 페이지
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filterKey;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/history" : `/history?filter=${f.key}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-500"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            기록이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {events.map((e) => (
              <HistoryRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <PageLink
            label="← 이전"
            disabled={pageNum <= 1}
            href={buildPageHref(filterKey, pageNum - 1)}
          />
          <span className="text-gray-500 dark:text-gray-400">
            {pageNum} / {totalPages}
          </span>
          <PageLink
            label="다음 →"
            disabled={pageNum >= totalPages}
            href={buildPageHref(filterKey, pageNum + 1)}
          />
        </nav>
      )}
    </div>
  );
}

function buildPageHref(filter: string, page: number): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/history?${qs}` : "/history";
}

function PageLink({
  label,
  disabled,
  href,
}: {
  label: string;
  disabled: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border border-gray-200 px-3 py-1.5 text-gray-400 dark:border-gray-800 dark:text-gray-600">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {label}
    </Link>
  );
}

function HistoryRow({ event }: { event: BalanceHistoryEntry }) {
  const meta = describe(event);
  const isCredit = event.delta >= 0;
  const deltaColor = isCredit
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] ${meta.bg}`}
        >
          {meta.icon}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900 dark:text-gray-100">
            {meta.label}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {formatTime(event.occurredAt)}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${deltaColor}`}>
          {isCredit ? "+" : ""}
          {event.delta}pt
        </p>
        <p className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
          잔고 {event.balanceAfter}
        </p>
      </div>
    </li>
  );
}

function describe(e: BalanceHistoryEntry): {
  label: string;
  icon: string;
  bg: string;
} {
  switch (e.type) {
    case "buy":
      return {
        label: `매수 · ${e.tickerName ?? "?"}`,
        icon: "▲",
        bg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
      };
    case "sell":
      return {
        label: `매도 · ${e.tickerName ?? "?"}`,
        icon: "▼",
        bg: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300",
      };
    case "liquidation":
      return {
        label: `청산 · ${e.tickerName ?? "?"}`,
        icon: "✕",
        bg: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
      };
    case "salary":
      return {
        label: `월급 (${yearMonth(e.occurredAt)})`,
        icon: "💰",
        bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      };
    case "init":
      return {
        label: "시작 시드",
        icon: "★",
        bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
      };
    case "round_reset":
      return {
        label: `라운드 리셋 (Week ${e.weekId ?? "?"})`,
        icon: "↻",
        bg: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
      };
  }
}

function yearMonth(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
