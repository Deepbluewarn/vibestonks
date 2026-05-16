import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events 스트림. 클라이언트는 EventSource로 구독.
 * 한 번 연결되면 trade/liquidation/reset 이벤트가 발생할 때마다
 * SSE 메시지로 푸시됨.
 *
 * 단일 인스턴스 메모리 기반(EventEmitter)이므로 멀티 인스턴스 배포 시
 * Redis pub/sub 등으로 교체 필요.
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // 컨트롤러가 이미 닫혔으면 무시
        }
      };

      // 초기 heartbeat — 클라이언트가 연결 확인할 수 있도록
      send({ type: "hello", ts: Date.now() });

      const unsubscribe = subscribe(send);

      // 15초마다 코멘트 heartbeat — 프록시(nginx 등) 유휴 타임아웃 방지
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // 클라이언트 연결 종료 처리
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // 이미 닫혔으면 무시
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx 버퍼링 끄기
    },
  });
}
