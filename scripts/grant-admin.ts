/**
 * 관리자 권한 토글 CLI.
 *
 * 사용:
 *   npm run admin:grant                       # 전체 트레이더 목록만 출력
 *   npm run admin:grant -- <sub|displayName>  # 매칭되는 트레이더의 isAdmin 토글
 *
 * sub 우선 매칭, 없으면 displayName 정확 매칭, 그것도 없으면 sub의 부분 매칭.
 * 여러 개 매칭되면 중단하고 후보 출력 — 명확히 하나만 지정해야 함.
 */
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db";

const arg = process.argv[2];
const all = db.select().from(schema.traders).all();

if (!arg) {
  if (all.length === 0) {
    console.log("(트레이더 없음. 로그인부터 해서 가입자를 만드세요)");
    process.exit(0);
  }
  console.log("등록된 트레이더:");
  for (const t of all) {
    const flag = t.isAdmin ? " ★admin" : "";
    console.log(`  ${t.displayName.padEnd(20)} ${t.sub}${flag}`);
  }
  console.log("\n사용: npm run admin:grant -- <sub | displayName>");
  process.exit(0);
}

const exact = all.filter((t) => t.sub === arg || t.displayName === arg);
const partial = exact.length > 0 ? exact : all.filter((t) => t.sub.includes(arg));

if (partial.length === 0) {
  console.error(`'${arg}'에 매칭되는 트레이더 없음.`);
  console.error("등록된 sub/displayName:");
  for (const t of all) console.error(`  ${t.displayName} ${t.sub}`);
  process.exit(1);
}

if (partial.length > 1) {
  console.error(`'${arg}'에 ${partial.length}명이 매칭됩니다. 더 정확히 지정하세요:`);
  for (const t of partial) console.error(`  ${t.displayName} ${t.sub}`);
  process.exit(1);
}

const target = partial[0];
const next = !target.isAdmin;
db.update(schema.traders)
  .set({ isAdmin: next })
  .where(eq(schema.traders.id, target.id))
  .run();

console.log(
  `✓ ${target.displayName} (${target.sub}) → isAdmin = ${next ? "true" : "false"}`,
);
