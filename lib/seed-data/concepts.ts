/**
 * 컨셉 종목 풀 — 일상 사건을 모티프로 한 농담 라벨.
 *
 * 가격은 매수·매도로만 움직이므로 라벨은 그저 농담이고, 실제 사건과 무관함.
 * 한국어/영어 혼용으로 사용 권역 넓힘.
 *
 * 새 라벨 추가는 자유롭게.
 */
export const CONCEPT_NAMES: readonly string[] = [
  // 사무실 / 일상
  "$오늘비왔다",
  "$지각러",
  "$모니터고장",
  "$프린터멈춤",
  "$WiFi끊김",
  "$화상회의튕김",
  "$엘리베이터고장",
  "$커피쏟음",
  "$메일실수전송",
  "$슬랙안읽음",
  "$팀장화남",
  "$상사칭찬",
  "$동료지각",
  "$회의길어짐",
  "$외근땡땡이",
  "$퇴근이른",
  "$야근플래그",
  "$월요병",
  "$금요휴가",
  "$점심맛없",
  "$간식떨어짐",
  "$택배도착",
  "$알람못들음",
  "$택시잡힘",
  "$지하철연착",
  // 개발 / 빌드
  "$빌드실패",
  "$테스트통과",
  "$핫픽스",
  "$배포롤백",
  "$PR머지",
  "$리뷰코멘트",
  "$린트경고",
  "$타입에러",
  "$DB락",
  "$깃충돌",
  "$의존성업데이트",
  "$nodemodules지옥",
  // 영어 풀
  "$rain",
  "$latebird",
  "$rage-quit",
  "$vibe-check",
  "$green-build",
  "$red-build",
  "$ghost-pr",
  "$standup-late",
  "$deadline-creep",
  "$code-freeze",
  "$coffee-spill",
  "$silent-mute",
  "$bad-merge",
  "$flaky-test",
  "$wfh-day",
  "$rto-mandate",
  "$open-office",
  "$keyboard-clack",
  "$mouse-drift",
  "$slack-storm",
  "$inbox-zero",
  "$inbox-doom",
  "$cookie-jar",
  "$friday-deploy",
  "$monday-blues",
] as const;

/** Pick N distinct random names. Throws if N > pool. */
export function pickRandomTickers(
  n: number,
  pool: readonly string[] = CONCEPT_NAMES,
): string[] {
  if (n > pool.length) {
    throw new Error(`requested ${n} names but pool only has ${pool.length}`);
  }
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
