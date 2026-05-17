import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isEdit = session.user.onboarded === true;
  const initial = session.user.displayName ?? session.user.name ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {isEdit ? "닉네임 변경" : "환영합니다"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEdit
              ? "변경한 닉네임은 랭킹과 거래 이력에 즉시 반영됩니다."
              : "랭킹에 표시될 닉네임을 정해주세요. 나중에 바꿀 수 있어요."}
          </p>
        </div>

        {!isEdit && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-xs leading-relaxed text-gray-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-gray-300">
            <p className="mb-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
              어떻게 노나?
            </p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <b>1,000pt</b>로 시작해 5종목을 사고 팝니다
              </li>
              <li>
                가격은 매수·매도로 움직임 — <b>다른 트레이더가 끼어들어야 차익</b>
              </li>
              <li>
                운영자가 라운드 마감하면 보유 주식이 <b>마감가로 자동 청산</b>
              </li>
              <li>
                매월 1일 첫 로그인 시 <b>+1,000pt 월급</b> 자동 입금
              </li>
              <li>
                다른 트레이더 포지션은 비공개. 종목 가격과 상위 3명 랭킹만 공개
              </li>
            </ul>
          </div>
        )}

        <OnboardingForm initialNickname={initial} isEdit={isEdit} />

        {isEdit && (
          <Link
            href="/dashboard"
            className="block text-center text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ← 대시보드로 돌아가기
          </Link>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          가짜 주식 시뮬레이션 · 실제 자산과 무관
        </p>
      </div>
    </div>
  );
}
