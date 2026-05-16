export default function TickerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
      <header className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="space-y-2 text-right">
          <div className="ml-auto h-9 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="ml-auto h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </header>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-48 w-full rounded bg-gray-100 dark:bg-gray-800/60" />
      </div>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-10 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
