"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로" : "다크 모드로"}
      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

/**
 * <head>에 인라인으로 박는 flash 방지 스크립트 (string으로 내보냄).
 * SSR이 끝나기 전, 첫 paint 직전에 동기 실행됨.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var t=localStorage.getItem('theme');
  var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(d) document.documentElement.classList.add('dark');
}catch(e){}})();
`;
