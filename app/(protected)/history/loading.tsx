export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="space-y-2">
        <div className="h-7 w-32 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-72 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-800" />
              <div className="space-y-1">
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="ml-auto h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="ml-auto h-3 w-12 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
