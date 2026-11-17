// 운세 카드 인장 (명세 38·39·41, 2026-11-15 앱 주인 결정). 그날의 성격을 낱말 도장으로 찍는다.
// 낱말은 자료다 — 앱 주인이 원장의 "인장" 칸에서 확정한 것(dict.ts DICT_SEALS). 확정 전에는 아래 초안을 쓴다.
// 고르는 법 (2026-11-15 "추천대로" — 개수는 날마다 다르다, 한쪽만 있어도 된다):
//   1) 그날 온 성격(중심·곁)마다, 그 성격의 면과 세기만큼 낱말을 찍는다.
//      - 세질 때(넘치는 기운 기·구) → 조심할 쪽(남색), 잘 쓸 때(필요한 기운 용·희) → 좋은 쪽(금빛)
//      - 가장 센 역할(용·기)은 낱말 둘, 그보다 약한 역할(희·구)은 하나
//      - 좋고 나쁨이 크지 않은 기운(한신·시간 모름)은 좋은 쪽 하나 + 조심할 쪽 하나
//      - 같은 성격이 천간·지지에 겹쳐 온 날은 한 단계 세게(희·구도 둘)
//   2) 좋은 쪽을 앞에 둔다(물음 14). 합쳐 1~4개.
//   3) 제목과 같은 말을 하는 낱말은 빼거나 같은 쪽 다른 낱말로 바꾼다(그릴링 Q1 — 코드가 막는다).
//   4) 하나만 찍는 칸은 최근 7일에 찍힌 낱말을 되도록 피한다(같은 성격이 며칠 안에 다시 와도 인장이 똑같지 않게).
import type { TenGod } from "@saju/engine";
import type { V5Material, V5Part } from "./compose";
import { DICT_SEALS } from "./dict";

export interface FortuneSeal {
  word: string;
  /** good = 오늘 힘이 되는 쪽 · care = 조심할 쪽 */
  tone: "good" | "care";
}
export type SealWords = Record<TenGod, { good: [string, string]; care: [string, string] }>;

/** 초안 — 원장에서 확정되기 전까지 */
export const SEAL_WORDS_DRAFT: SealWords = {
  비견: { good: ["내 선택", "결단"], care: ["고집", "의견 충돌"] },
  겁재: { good: ["승부욕", "몰입"], care: ["조바심", "급한 지출"] },
  식신: { good: ["여유", "부드러운 말"], care: ["미루기", "말이 길어짐"] },
  상관: { good: ["실력 발휘", "분명한 말"], care: ["날 선 말", "흠잡기"] },
  편재: { good: ["새 제안", "먼저 연락"], care: ["일만 늘림", "씀씀이 커짐"] },
  정재: { good: ["실속", "결과 확인"], care: ["눈앞 계산", "지나친 절약"] },
  편관: { good: ["집중 처리", "끝내는 힘"], care: ["압박", "힘의 소모"] },
  정관: { good: ["계획대로", "믿음 쌓기"], care: ["기대 부담", "내 탓"] },
  편인: { good: ["다른 발상", "깊은 생각"], care: ["곱씹기", "결론 지연"] },
  정인: { good: ["배움", "쉼"], care: ["머뭇거림", "시작 미룸"] },
};
export const SEAL_WORDS: SealWords = DICT_SEALS ?? SEAL_WORDS_DRAFT;

/** 제목과 같은 말인가: 두 글자 넘는 어절의 앞 두 글자가 제목에 있으면. 한 글자 어절("말", "내")은 흔해서 보지 않는다(낱말이 한 글자뿐이면 그 글자를 본다) */
export function echoes(word: string, headline: string): boolean {
  const h = headline.replace(/\s+/g, "");
  const long = word.split(/\s+/).filter((t) => t.length >= 2);
  return long.length ? long.some((t) => h.includes(t.slice(0, 2))) : h.includes(word.trim());
}

/** 한 성격이 찍을 낱말 수 — 좋은 쪽·조심할 쪽 */
export function sealCount(p: Pick<V5Part, "face" | "label">, doubled = false): { good: number; care: number } {
  if (p.face === "both") return { good: 1, care: 1 };
  const strong = p.label === "용" || p.label === "기" || doubled;
  const n = strong ? 2 : 1;
  return p.face === "strong" ? { good: 0, care: n } : { good: n, care: 0 };
}

export function sealsOf(m: Pick<V5Material, "core" | "other" | "band">, headline = "", recentWords: readonly string[] = []): FortuneSeal[] {
  const recent = new Set(recentWords);
  const taken = new Set<string>();
  const out: FortuneSeal[] = [];
  const parts = m.other ? [m.core, m.other] : [m.core];
  for (const p of parts) {
    const want = sealCount(p, !m.other);
    for (const tone of ["good", "care"] as const) {
      const n = want[tone];
      if (!n) continue;
      const pair = SEAL_WORDS[p.tenGod][tone].filter((w) => !taken.has(w));
      const clean = pair.filter((w) => !(headline && echoes(w, headline)));
      // 하나만 찍을 때는 최근 7일에 안 쓴 낱말을 먼저
      const ordered = n === 1 ? [...clean.filter((w) => !recent.has(w)), ...clean.filter((w) => recent.has(w))] : clean;
      for (const w of ordered.slice(0, n)) { out.push({ word: w, tone }); taken.add(w); }
    }
  }
  // 모두 제목과 겹쳐 하나도 못 찍었으면 중심의 첫 낱말 하나는 남긴다
  if (!out.length) {
    const tone = m.core.face === "strong" ? "care" : "good";
    out.push({ word: SEAL_WORDS[m.core.tenGod][tone][0], tone });
  }
  return [...out.filter((s) => s.tone === "good"), ...out.filter((s) => s.tone === "care")];
}
