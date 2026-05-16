interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string }>;
}

const errorMessages: Record<string, string> = {
  Configuration: "서버 설정 오류가 발생했습니다. 관리자에게 문의하세요.",
  AccessDenied: "접근 권한이 없습니다.",
  Verification: "인증 링크가 만료되었거나 이미 사용되었습니다.",
  OAuthSignin: "OAuth 연결 중 오류가 발생했습니다.",
  OAuthCallback: "OAuth 응답 처리 중 오류가 발생했습니다.",
  OAuthCreateAccount: "계정 생성 중 오류가 발생했습니다.",
  Default: "인증 중 알 수 없는 오류가 발생했습니다.",
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { error } = await searchParams;
  const message = errorMessages[error ?? "Default"] ?? errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <div className="text-5xl">⚠️</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            인증 오류
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
          {process.env.NODE_ENV === "development" && error && (
            <p className="rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-400 dark:bg-gray-950 dark:text-gray-500">
              {error}
            </p>
          )}
        </div>
        <a
          href="/login"
          className="inline-block rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          로그인으로 돌아가기
        </a>
      </div>
    </div>
  );
}
