import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-md dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
        <div className="text-5xl">🫥</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            404
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            없는 페이지예요. 종목이 사라졌거나 URL이 잘못된 것 같아요.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          대시보드로
        </Link>
      </div>
    </div>
  );
}
