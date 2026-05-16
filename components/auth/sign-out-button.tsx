"use client";

import { signOutAction } from "@/lib/actions/auth";

interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className }: SignOutButtonProps) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        title="로그아웃"
        aria-label="로그아웃"
        className={
          className ??
          "rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:px-3"
        }
      >
        <span className="hidden sm:inline">로그아웃</span>
        <span className="sm:hidden" aria-hidden>
          ⎋
        </span>
      </button>
    </form>
  );
}
