"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminLiquidate,
  adminRenameTicker,
  adminReset,
  adminRotate,
  adminToggleTraderAdmin,
  type AdminActionResult,
} from "@/lib/actions/admin";
import { Toast } from "@/components/toast";

export function AdminActions({
  hasActiveWeek,
  tickers,
  traders,
  currentAdminTraderId,
}: {
  hasActiveWeek: boolean;
  tickers: { id: number; name: string }[];
  traders: {
    id: number;
    displayName: string;
    sub: string;
    isAdmin: boolean;
    currentBalance: number | null;
  }[];
  currentAdminTraderId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<AdminActionResult | null>(null);

  const run = (fn: () => Promise<AdminActionResult>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setFlash(null);
    startTransition(async () => {
      const r = await fn();
      setFlash(r);
      router.refresh();
    });
  };

  return (
    <>
      {flash && (
        <Toast
          message={flash.ok ? flash.message : flash.error}
          variant={flash.ok ? "success" : "error"}
          onDismiss={() => setFlash(null)}
        />
      )}

      <Section title="사이클 관리" subtitle="라운드 마감과 시작을 직접 트리거합니다.">
        <div className="flex flex-wrap gap-2">
          <DangerBtn
            disabled={pending || !hasActiveWeek}
            onClick={() =>
              run(adminLiquidate, "활성 라운드를 청산합니다. 진행할까요?")
            }
          >
            🔚 라운드 마감 (Liquidate)
          </DangerBtn>
          <NeutralBtn
            disabled={pending || hasActiveWeek}
            onClick={() =>
              run(adminReset, "새 라운드를 시작합니다. 진행할까요?")
            }
          >
            🚀 새 라운드 시작 (Reset)
          </NeutralBtn>
          <PrimaryBtn
            disabled={pending || !hasActiveWeek}
            onClick={() =>
              run(
                adminRotate,
                "라운드 마감 + 새 라운드 시작을 한 번에. 진행할까요?",
              )
            }
          >
            🔁 회전 (Liquidate + Reset)
          </PrimaryBtn>
        </div>
      </Section>

      <Section
        title="종목 관리"
        subtitle={
          hasActiveWeek
            ? "현재 라운드 종목 이름 변경. 변경은 모든 라운드에 영향 (글로벌 이름)."
            : "활성 라운드가 없어 종목을 표시할 수 없습니다."
        }
      >
        <ul className="space-y-2">
          {tickers.map((t) => (
            <TickerRow key={t.id} ticker={t} pending={pending} run={run} />
          ))}
        </ul>
      </Section>

      <Section
        title="트레이더"
        subtitle="가입한 트레이더 목록 + 관리자 권한 토글. 본인은 토글 불가."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-2 py-2 text-left font-medium">이름</th>
                <th className="px-2 py-2 text-left font-medium">sub</th>
                <th className="px-2 py-2 text-right font-medium">잔고</th>
                <th className="px-2 py-2 text-center font-medium">권한</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {traders.map((t) => (
                <tr key={t.id}>
                  <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-100">
                    {t.displayName}
                    {t.id === currentAdminTraderId && (
                      <span className="ml-1 text-[10px] text-gray-400">(나)</span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                    {t.sub}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.currentBalance !== null ? `${t.currentBalance}pt` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      disabled={
                        pending || t.id === currentAdminTraderId
                      }
                      onClick={() =>
                        run(
                          () => adminToggleTraderAdmin(t.id),
                          `${t.displayName}의 관리자 권한을 ${t.isAdmin ? "해제" : "부여"}합니다. 진행할까요?`,
                        )
                      }
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        t.isAdmin
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      {t.isAdmin ? "관리자 ✓" : "일반"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function TickerRow({
  ticker,
  pending,
  run,
}: {
  ticker: { id: number; name: string };
  pending: boolean;
  run: (
    fn: () => Promise<AdminActionResult>,
    confirm?: string,
  ) => void;
}) {
  const [draft, setDraft] = useState(ticker.name);
  const dirty = draft.trim() !== ticker.name && draft.trim().length > 0;

  return (
    <li className="flex items-center gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={30}
        className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 font-mono text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
      />
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          run(
            () => adminRenameTicker(ticker.id, draft),
            `종목 이름을 "${draft}"로 변경합니다. 진행할까요?`,
          )
        }
        className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
      >
        변경
      </button>
    </li>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function PrimaryBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-500 dark:hover:bg-indigo-400"
    />
  );
}
function NeutralBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
    />
  );
}
function DangerBtn(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
    />
  );
}
