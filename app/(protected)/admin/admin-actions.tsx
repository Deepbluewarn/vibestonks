"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminBotRemove,
  adminBotStart,
  adminBotStop,
  adminFullWipe,
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
  botStatus,
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
  botStatus: { running: boolean; count: number; speed: number };
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

      <BotSection
        botStatus={botStatus}
        pending={pending}
        run={run}
      />

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

      <DangerZone pending={pending} run={run} />
    </>
  );
}

function DangerZone({
  pending,
  run,
}: {
  pending: boolean;
  run: (fn: () => Promise<AdminActionResult>, confirm?: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-rose-300 bg-rose-50/30 p-5 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20 dark:shadow-none">
      <div>
        <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          위험 구역
        </h2>
        <p className="mt-0.5 text-xs text-rose-700/80 dark:text-rose-400/80">
          되돌릴 수 없는 작업. 트레이더 계정(로그인 정보)과 종목 목록은 유지됨.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <DangerBtn
          disabled={pending}
          onClick={() =>
            run(
              adminFullWipe,
              "⚠ 전체 초기화\n\n모든 라운드·거래·잔고·잔고변동 기록·보유·종목상태를 지웁니다.\n트레이더 계정과 종목 이름만 남아요.\n\n진짜 진행할까요?",
            )
          }
        >
          🧨 전체 초기화 (잔고·기록 전부)
        </DangerBtn>
      </div>
    </section>
  );
}

function BotSection({
  botStatus,
  pending,
  run,
}: {
  botStatus: { running: boolean; count: number; speed: number };
  pending: boolean;
  run: (fn: () => Promise<AdminActionResult>, confirm?: string) => void;
}) {
  const [count, setCount] = useState(
    botStatus.count > 0 ? botStatus.count : 100,
  );
  const [speed, setSpeed] = useState(botStatus.speed > 0 ? botStatus.speed : 1);

  return (
    <Section
      title="봇 시뮬레이터"
      subtitle="가짜 트레이더 봇으로 시장 분위기 만들기. 6가지 페르소나 믹스."
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            botStatus.running
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {botStatus.running
            ? `▶ 실행 중 · ${botStatus.count}명 · ×${botStatus.speed}`
            : "■ 중지됨"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            수량
          </span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 w-24 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            속도 (×)
          </span>
          <input
            type="number"
            min={0.1}
            max={100}
            step={0.5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="mt-1 w-24 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <PrimaryBtn
            disabled={pending}
            onClick={() =>
              run(
                () => adminBotStart(count, speed),
                botStatus.running
                  ? `봇 ${count}명 / 속도 ×${speed}로 재시작합니다.`
                  : `봇 ${count}명 / 속도 ×${speed}로 시작합니다.`,
              )
            }
          >
            {botStatus.running ? "🔄 재시작" : "▶ 시작"}
          </PrimaryBtn>
          {botStatus.running && (
            <NeutralBtn
              disabled={pending}
              onClick={() =>
                run(adminBotStop, "봇을 중지합니다. (트레이더 계정은 유지)")
              }
            >
              ■ 중지
            </NeutralBtn>
          )}
          <DangerBtn
            disabled={pending}
            onClick={() =>
              run(
                adminBotRemove,
                "봇 트레이더 + 관련 거래/잔고 이력을 모두 삭제합니다. 진행할까요?",
              )
            }
          >
            🗑 전부 제거
          </DangerBtn>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        속도 5배 이상에선 Scalper 봇이 rate limit(트레이더당 10초/15회)에 걸려 거래
        일부 거부됨. 서버 재시작 시 환경변수 BOT_ENABLED 따름.
      </p>
    </Section>
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
