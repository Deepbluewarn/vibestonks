/**
 * Next.js boot hook. nodejs runtime에서만 호출됨.
 * - BOT_ENABLED=true 면 봇 시뮬레이터 자동 시작 (count는 BOT_COUNT env 또는 기본 100)
 * - 런타임 제어는 /admin 페이지에서 가능 (env 토글은 영구 default)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.BOT_ENABLED !== "true") {
    console.log("[bots] BOT_ENABLED != true, not auto-starting");
    return;
  }
  const { startBots } = await import("./lib/bots/runner");
  startBots();
}
