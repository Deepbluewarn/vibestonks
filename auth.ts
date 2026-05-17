import NextAuth from "next-auth";
import { and, eq } from "drizzle-orm";
import authConfig from "./auth.config";
import { db, schema } from "@/lib/db";
import { publish } from "@/lib/events";

const SEED_POINTS = 1000;
const SALARY_POINTS = 1000;

/**
 * 그 주의 월요일 날짜를 YYYY-MM-DD로 반환. 주급 입금 여부를 주(Mon-Sun) 단위로 비교.
 * 월요일 기준이라 일요일 23:59와 월요일 00:01은 서로 다른 주로 처리됨.
 */
function weekKey(d: Date): string {
  const monday = new Date(d.getTime());
  const day = monday.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    /**
     * On every sign-in:
     * 1. Upsert trader by namespaced sub `{provider}:{providerAccountId}`
     * 2. If there's an active week with no balance row for this trader, seed 1000
     * 3. 신규 트레이더는 lastSalaryAt=now로 표시 (첫 달 이중 지급 방지)
     */
    async signIn({ user, account }) {
      if (!account) return false;
      const sub = `${account.provider}:${account.providerAccountId}`;
      const displayName = user.name || user.email?.split("@")[0] || "Trader";

      let trader = db
        .select()
        .from(schema.traders)
        .where(eq(schema.traders.sub, sub))
        .get();
      if (!trader) {
        // displayName 충돌 시 suffix(-2, -3, ...)로 유일성 보장. 본인은 나중에
        // /onboarding 에서 원하는 이름으로 바꿀 수 있음.
        let unique = displayName;
        let n = 1;
        while (
          db
            .select()
            .from(schema.traders)
            .where(eq(schema.traders.displayName, unique))
            .get()
        ) {
          n += 1;
          unique = `${displayName}-${n}`;
        }
        trader = db
          .insert(schema.traders)
          .values({ sub, displayName: unique, lastSalaryAt: new Date() })
          .returning()
          .get();
      }

      const activeWeek = db
        .select()
        .from(schema.weeks)
        .where(eq(schema.weeks.isActive, true))
        .get();
      if (activeWeek) {
        const existing = db
          .select()
          .from(schema.balances)
          .where(
            and(
              eq(schema.balances.weekId, activeWeek.id),
              eq(schema.balances.traderId, trader.id),
            ),
          )
          .get();
        if (!existing) {
          db.insert(schema.balances)
            .values({
              weekId: activeWeek.id,
              traderId: trader.id,
              points: SEED_POINTS,
            })
            .run();
          db.insert(schema.balanceEvents)
            .values({
              traderId: trader.id,
              weekId: activeWeek.id,
              delta: SEED_POINTS,
              balanceAfter: SEED_POINTS,
              type: "init",
            })
            .run();
        }
      }
      return true;
    },

    async jwt({ token, account }) {
      if (account) {
        token.sub = `${account.provider}:${account.providerAccountId}`;
      }
      return token;
    },

    async session({ session, token }) {
      if (!token.sub) return session;

      const trader = db
        .select()
        .from(schema.traders)
        .where(eq(schema.traders.sub, token.sub))
        .get();
      if (!trader) return session;

      // ---- 월급 체크 ----
      const currentWeek = weekKey(new Date());
      const lastWeek = trader.lastSalaryAt
        ? weekKey(new Date(trader.lastSalaryAt))
        : null;

      let salaryJustCredited = false;
      if (lastWeek !== currentWeek) {
        // 같은 트랜잭션 안에서 read-check-write로 race condition 방지
        db.transaction((tx) => {
          const fresh = tx
            .select()
            .from(schema.traders)
            .where(eq(schema.traders.id, trader.id))
            .get();
          if (!fresh) return;
          const freshWeek = fresh.lastSalaryAt
            ? weekKey(new Date(fresh.lastSalaryAt))
            : null;
          if (freshWeek === currentWeek) return; // 다른 요청이 이미 처리

          const activeWeek = tx
            .select()
            .from(schema.weeks)
            .where(eq(schema.weeks.isActive, true))
            .get();
          if (!activeWeek) return; // 활성 주차가 없으면 다음 라운드까지 보류

          const bal = tx
            .select()
            .from(schema.balances)
            .where(
              and(
                eq(schema.balances.weekId, activeWeek.id),
                eq(schema.balances.traderId, trader.id),
              ),
            )
            .get();
          if (!bal) return; // 잔고 row 없으면 신규 가입 직후 — signIn에서 처리됨

          tx.update(schema.balances)
            .set({ points: bal.points + SALARY_POINTS })
            .where(
              and(
                eq(schema.balances.weekId, activeWeek.id),
                eq(schema.balances.traderId, trader.id),
              ),
            )
            .run();

          tx.update(schema.traders)
            .set({ lastSalaryAt: new Date() })
            .where(eq(schema.traders.id, trader.id))
            .run();

          tx.insert(schema.balanceEvents)
            .values({
              traderId: trader.id,
              weekId: activeWeek.id,
              delta: SALARY_POINTS,
              balanceAfter: bal.points + SALARY_POINTS,
              type: "salary",
            })
            .run();

          salaryJustCredited = true;
        });

        if (salaryJustCredited) {
          // 다른 클라이언트도 잔고/랭킹 갱신하도록 알림 — 가격은 변동 없음
          publish({
            type: "trade",
            tickerId: -1,
            price: 0,
            outstandingShares: 0,
          });
        }
      }

      session.user.traderId = trader.id;
      session.user.isAdmin = trader.isAdmin;
      session.user.displayName = trader.displayName;
      session.user.onboarded = trader.onboardedAt !== null;
      session.user.lastSalaryAt = trader.lastSalaryAt
        ? new Date(trader.lastSalaryAt).toISOString()
        : null;
      session.user.salaryJustCredited = salaryJustCredited;
      return session;
    },
  },
});
