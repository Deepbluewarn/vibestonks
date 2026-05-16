import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.onboarded) redirect("/dashboard");

  const initial = session.user.displayName ?? session.user.name ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            환영합니다
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            랭킹에 표시될 닉네임을 정해주세요. 나중에 바꿀 수 있어요.
          </p>
        </div>

        <OnboardingForm initialNickname={initial} />

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          가짜 주식 시뮬레이션 · 실제 자산과 무관
        </p>
      </div>
    </div>
  );
}
