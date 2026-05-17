"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions/onboard";

interface Props {
  initialNickname: string;
  isEdit?: boolean;
}

export function OnboardingForm({ initialNickname, isEdit = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(initialNickname);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(formData);
      if (result && !result.ok) setError(result.error);
    });
  };

  const unchanged = nickname.trim() === initialNickname.trim();

  return (
    <form action={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          닉네임
        </span>
        <input
          name="nickname"
          type="text"
          required
          minLength={2}
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="예: 김거래"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
          autoFocus
        />
        <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
          2~20자
        </span>
      </label>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || nickname.trim().length < 2 || (isEdit && unchanged)}
        className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        {pending ? "저장 중..." : isEdit ? "변경하기" : "시작하기"}
      </button>
    </form>
  );
}
