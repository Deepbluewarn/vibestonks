import Link from "next/link";

const REPO_URL = "https://github.com/Deepbluewarn/vibestonks";
const AUTHOR = "bluewarn";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-gray-200 pt-6 pb-8 text-center text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
      <p>가짜 주식 시뮬레이션 · 실제 자산과 무관</p>
      <p className="mt-1.5">
        Made with{" "}
        <span className="text-rose-400 dark:text-rose-500" aria-label="love">
          ♥
        </span>{" "}
        by{" "}
        <span className="font-medium text-gray-500 dark:text-gray-400">
          {AUTHOR}
        </span>
        <span className="mx-2 text-gray-300 dark:text-gray-700">·</span>
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-700 hover:underline dark:hover:text-gray-300"
        >
          GitHub
        </Link>
      </p>
    </footer>
  );
}
