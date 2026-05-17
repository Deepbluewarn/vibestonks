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
