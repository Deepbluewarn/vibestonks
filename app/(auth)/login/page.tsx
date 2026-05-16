import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

const PROVIDERS = [
  { id: "google", label: "Google로 로그인" },
  { id: "github", label: "GitHub로 로그인" },
] as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            vibestonks
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            로그인해서 이번 주 1,000 포인트 받기
          </p>
        </div>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            로그인 중 오류가 발생했습니다. 다시 시도해 주세요.
          </div>
        )}

        <div className="space-y-3">
          {PROVIDERS.map((p) => (
            <form
              key={p.id}
              action={async () => {
                "use server";
                try {
                  await signIn(p.id, {
                    redirectTo: callbackUrl ?? "/dashboard",
                  });
                } catch (err) {
                  if (err instanceof AuthError) {
                    redirect(`/auth/error?error=${err.type}`);
                  }
                  throw err;
                }
              }}
            >
              <button
                type="submit"
                className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {p.label}
              </button>
            </form>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          가짜 주식 시뮬레이션 · 실제 자산과 무관
        </p>
      </div>
    </div>
  );
}
