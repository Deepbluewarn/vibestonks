/**
 * Next.js boot hook. nodejs runtime에서만 호출됨.
 * - 봇 시뮬레이터 시작 (BOT_ENABLED=true 일 때만)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBots } = await import("./lib/bots/runner");
  startBots();
}
