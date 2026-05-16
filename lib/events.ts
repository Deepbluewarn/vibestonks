/**
 * 인-프로세스 이벤트 버스. 한 Next.js 인스턴스 안에서 작동.
 * 멀티 인스턴스로 확장하면 Redis pub/sub 등으로 교체 필요.
 *
 * 사용:
 *   publish({ type: "trade", ... });
 *   const unsubscribe = subscribe((event) => { ... });
 *   unsubscribe();
 *
 * NOTE: globalThis에 emitter를 보관해서 Next.js dev 모드(Turbopack 모듈 중복 평가,
 * server action / route handler가 별도 모듈 인스턴스를 받는 경우)에도 단일 emitter
 * 보장. Prisma 등에서 쓰는 표준 패턴.
 */
import { EventEmitter } from "node:events";

export type VibestonksEvent =
  | { type: "trade"; tickerId: number; price: number; outstandingShares: number }
  | { type: "liquidation"; weekId: number }
  | { type: "reset"; weekId: number };

const CHANNEL = "vibestonks";

const globalForEvents = globalThis as unknown as {
  __vibestonksEmitter?: EventEmitter;
  __vibestonksEmitterId?: string;
};

if (!globalForEvents.__vibestonksEmitter) {
  const e = new EventEmitter();
  e.setMaxListeners(200);
  globalForEvents.__vibestonksEmitter = e;
  globalForEvents.__vibestonksEmitterId = Math.random().toString(36).slice(2, 8);
  console.log(`[events] singleton created id=${globalForEvents.__vibestonksEmitterId}`);
}

const emitter = globalForEvents.__vibestonksEmitter;
const EID = globalForEvents.__vibestonksEmitterId;

export function publish(event: VibestonksEvent): void {
  console.log(
    `[events] publish ${event.type} (emitter=${EID}, listeners=${emitter.listenerCount(CHANNEL)})`,
  );
  emitter.emit(CHANNEL, event);
}

export function subscribe(handler: (event: VibestonksEvent) => void): () => void {
  emitter.on(CHANNEL, handler);
  console.log(
    `[events] subscribe (emitter=${EID}, listeners=${emitter.listenerCount(CHANNEL)})`,
  );
  return () => {
    emitter.off(CHANNEL, handler);
    console.log(
      `[events] unsubscribe (emitter=${EID}, listeners=${emitter.listenerCount(CHANNEL)})`,
    );
  };
}
