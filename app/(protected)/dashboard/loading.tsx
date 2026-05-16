export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-56 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="space-y-2 text-right">
          <div className="ml-auto h-3 w-14 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="ml-auto h-8 w-28 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="ml-auto h-3 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:shadow-none"
          >
            <div className="flex items-start justify-between">
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-7 w-12 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="mt-3 h-16 w-full rounded bg-gray-100 dark:bg-gray-800/60" />
            <div className="mt-3 flex justify-between">
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
