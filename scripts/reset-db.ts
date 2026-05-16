/**
 * 개발용: SQLite 파일을 통째로 지우고 마이그레이션을 다시 돌린다.
 * 이후 별도로 npm run db:seed 를 실행하면 1주차 + 종목 + dev trader 생성됨.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const dbPath =
  process.env.VIBESTONKS_DB_PATH ?? path.resolve(process.cwd(), ".data/db.sqlite");

for (const ext of ["", "-journal", "-wal", "-shm"]) {
  const p = dbPath + ext;
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`✓ removed ${p}`);
  }
}

console.log("→ running migrations...");
execSync("npx drizzle-kit migrate", { stdio: "inherit" });
console.log("✓ migrations applied");
console.log("\nNext: npm run db:seed");
