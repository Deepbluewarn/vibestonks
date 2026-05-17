"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

export type OnboardResult = { ok: false; error: string };

export async function completeOnboarding(
  formData: FormData,
): Promise<OnboardResult | void> {
  const session = await auth();
  if (!session?.user?.traderId) return { ok: false, error: "로그인 필요" };

  const raw = (formData.get("nickname") as string | null) ?? "";
  const nickname = raw.trim();

  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자여야 합니다`,
    };
  }
  if (/[\r\n\t]/.test(nickname)) {
    return { ok: false, error: "공백/줄바꿈은 사용할 수 없습니다" };
  }

  const taken = db
    .select()
    .from(schema.traders)
    .where(
      and(
        eq(schema.traders.displayName, nickname),
        ne(schema.traders.id, session.user.traderId),
      ),
    )
    .get();
  if (taken) {
    return { ok: false, error: "이미 사용 중인 닉네임입니다" };
  }

  try {
    db.update(schema.traders)
      .set({ displayName: nickname, onboardedAt: new Date() })
      .where(eq(schema.traders.id, session.user.traderId))
      .run();
  } catch (e) {
    // 동시 요청 race로 unique constraint 위반 시
    if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) {
      return { ok: false, error: "이미 사용 중인 닉네임입니다" };
    }
    throw e;
  }

  redirect("/dashboard");
}
