/**
 * 컨셉 종목 풀 — 일상 사건을 모티프로 한 농담 라벨.
 *
 * 가격은 매수·매도로만 움직이므로 라벨은 그저 농담이고, 실제 사건과 무관함.
 * 누구나 한 번 보면 '아 그런 거?' 알 수 있는 보편 사건 위주로 구성.
 */
export const CONCEPT_NAMES: readonly string[] = [
  // 날씨 / 계절
  "$오늘비왔다",
  "$장마시작",
  "$폭우주의",
  "$첫눈",
  "$무더위",
  "$미세먼지",
  "$한파주의",
  "$단풍시즌",
  "$벚꽃엔딩",
  "$태풍오는날",
  "$우산챙긴날",
  "$우산잃어버림",

  // 출퇴근 / 교통
  "$지하철놓침",
  "$지하철연착",
  "$택시잡힘",
  "$택시못잡음",
  "$차막힘",
  "$신호운좋음",
  "$신호운나쁨",
  "$알람못들음",
  "$지각러",

  // 음식 / 배달
  "$야식의유혹",
  "$치킨주문",
  "$떡볶이생각",
  "$배민할인",
  "$냉장고털기",
  "$매운맛도전",
  "$아메리카노한잔",
  "$점심메뉴고민",
  "$점심맛없",
  "$간식떨어짐",
  "$무료커피",

  // 직장 / 사무실
  "$월요병",
  "$불금",
  "$연차의기쁨",
  "$출근길피곤",
  "$퇴근후맥주",
  "$칼퇴",
  "$야근플래그",
  "$팀장기분",
  "$상사칭찬",
  "$회의길어짐",
  "$화상회의튕김",
  "$WiFi끊김",
  "$모니터고장",
  "$엘리베이터고장",
  "$커피쏟음",
  "$메일실수전송",
  "$택배도착",
  "$택배분실",

  // 관계 / 커뮤니케이션
  "$카톡씹힘",
  "$단톡방울림",
  "$썸타기",
  "$친구약속",
  "$부모님전화",
  "$동창모임",

  // 미디어 / 취미
  "$넷플정주행",
  "$유튜브알고리즘",
  "$드라마결말",
  "$신곡출시",
  "$아이돌컴백",
  "$책한권완독",
  "$게임승률",
  "$노래방신곡",

  // 운 / 우연
  "$복권당첨",
  "$길에서주운돈",
  "$맛집웨이팅",
  "$대박터짐",
  "$오늘의운세",
  "$행운의숫자",

  // 짧은 영어 (보편적)
  "$rain",
  "$sunshine",
  "$monday-blues",
  "$friday-vibes",
  "$lucky-day",
  "$oops",
  "$fomo",
  "$cozy",
  "$jackpot",
  "$coffee-spill",
  "$power-nap",
  "$cheers",
  "$hangover",
  "$brain-fog",
  "$rage-quit",
  "$vibe-check",
  "$inbox-doom",
  "$wfh-day",
  "$cookie-jar",
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
