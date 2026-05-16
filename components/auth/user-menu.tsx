import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

interface UserMenuProps {
  session: Session;
}

export function UserMenu({ session }: UserMenuProps) {
  const { name, email, image, displayName } = session.user;
  const label = displayName ?? name ?? "Trader";

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-100">
          {label}
        </p>
        <p className="text-xs leading-tight text-gray-500 dark:text-gray-400">
          {email}
        </p>
      </div>

      {image ? (
        <Image
          src={image}
          alt={label}
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
          {label[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <Link
        href="/history"
        title="내 기록"
        aria-label="내 기록 페이지로 이동"
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:px-3"
      >
        <span className="hidden sm:inline">내 기록</span>
        <span className="sm:hidden" aria-hidden>
          📜
        </span>
      </Link>

      {session.user.isAdmin && (
        <Link
          href="/admin"
          title="관리자"
          aria-label="관리자 페이지로 이동"
          className="rounded-md border border-indigo-300 px-2 py-1.5 text-sm text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40 sm:px-3"
        >
          <span className="hidden sm:inline">관리자</span>
          <span className="sm:hidden" aria-hidden>
            🛠
          </span>
        </Link>
      )}

      <SignOutButton />
    </div>
  );
}
