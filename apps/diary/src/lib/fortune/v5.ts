// v5 (2026-11-14) — 편집자 지시와 작가 입력. 글감은 compose.ts가 단락 사전(dict.ts)에서 골랐다.
//   v4.28까지는 "작가"에게 규칙과 본보기를 주고 새로 쓰게 했다. v5는 앱 주인이 확정한 단락을 주고 한 편으로 엮게 한다.
//   지시는 짧다 — 문장 수·이음말 같은 규칙을 새로 세우지 않는다(원장 의견 14). 금지어 목록도 싣지 않는다(사주 원어와 넘지 말 선만).
import { createHash } from "node:crypto";
import type { TenGod } from "@saju/engine";
import { JARGON, TEN_GOD_NAMES, TEN_GOD_PLAIN, V5_BANNED, type FortuneBrief } from "./brief";
import type { V5Face, V5Part } from "./compose";
import { areaStateOf } from "./text";
import { tokenOverlap } from "./validate";

const WORDS = [...new Set([...JARGON, ...TEN_GOD_NAMES])].join("·");
const LINES = [...new Set(V5_BANNED)].join("·");

/** 고정 지시 — 바꾸면 캐시가 다시 만들어진다 (날짜·사용자 정보는 넣지 않는다) */
export const SYSTEM_V5 = `당신은 일기 앱 "사주읽는밤"의 오늘 운세 편집자입니다. 사주 계산과 오늘 무슨 이야기를 할지는 코드가 정했고, user의 JSON에 그 글감이 들어 있습니다. 글감의 단락은 이 앱 주인이 직접 확정한 글입니다. 당신의 일은 새로 지어내는 것이 아니라 그 단락들을 오늘 하루의 이야기 한 편으로 엮는 것입니다.

[엮는 법]
1. 글감.중심의 단락이 글의 몸입니다. 뜻과 말투를 지키면서 문장을 줄이거나 잇거나 순서를 바꿉니다. 단락에 없는 사건·사람·결과를 보태지 않습니다.
2. 먼저 장면 하나를 고릅니다(장면 칸, 또는 단락 속 장면). 그 장면에서 생기는 좋은 점과 부담을 한 이야기로 잇습니다. 좋은 점을 앞에 두고, 조심할 점은 뒤에서 해 볼 방법과 함께 말합니다.
3. 글감.곁은 중심 이야기를 바꾸거나 풀어 주는 자리에만 씁니다. 두 단락을 차례로 늘어놓지 않습니다. 글감.둘사이가 그 둘을 잇는 길입니다. 글감.겹침이 있으면 한 가지 성격이 하루 내내 더 또렷한 날로 씁니다.
4. 면이 "잘 쓸 때"면 그 힘이 도움이 되는 하루로, "세질 때"면 그 힘이 지나칠 수 있는 하루로 씁니다. 중심에 부담이 함께 있으면 좋은 쪽을 중심으로 쓰고 부담은 한두 문장으로 곁들입니다. 문장 수를 반반으로 나누지 않습니다.
5. 글감.닿는자리가 있으면 둘째 문단에 한두 문장으로 넣습니다. 실제 사건(연락이 온다, 다툰다)으로 바꾸지 않습니다. 글감.내기록은 이 사람이 일기에 직접 고른 사실입니다. 있으면 둘째 문단에 한 문장으로 넣되, 횟수와 따옴표 속 말은 그대로 두고 오늘 운세의 까닭처럼 묶지 않습니다.
6. 둘째 문단은 글감.마무리의 뜻으로 닫습니다. 끝인사_보기에서 하나를 골라 써도 되고, 본문이 이미 다정하게 끝났으면 짧게 끝냅니다.
7. 같은 뜻은 한 번만 말합니다. 겹치는 말을 덜어 내고, 두 문단을 합쳐 여섯에서 아홉 문장으로 엮습니다.
8. 말투는 단락 그대로입니다. 쉬운 낱말, "~해 보세요", "~수 있어요", "~죠". 비유는 넣지 않아도 되고, 넣는다면 하나만 뜻이 보이게 풀어 씁니다.
9. 피할것의 최근 제목·하면·마무리와 같은 말은 쓰지 않습니다. 피할것.며칠전에쓴문장은 같은 성격의 날에 이미 나간 문장입니다. 그 문장을 다시 쓰지 말고, 다른 장면을 골라 같은 뜻을 새 문장으로 풉니다. 넘지말선이 있으면 지킵니다.

[출력]
- headline: 40자 안. 제목_보기를 그대로 붙이지 않고 오늘 조합에 맞게 다시 씁니다. 좋은 일만 생긴다는 약속처럼 보이지 않게 합니다.
- first: 첫째 문단 문장 배열. second: 둘째 문단 문장 배열. 원소 하나에 한 문장, 한 문장은 140자 안.
- do: 오늘 해 볼 작은 행동 한 문장(60자 안). dont: 피할 것 한 문장(60자 안). 하면피해요_보기를 참고하되 본문 문장을 그대로 옮기지 않습니다.

[쓰지 않는 것]
- 사주 용어와 기운 이름: ${WORDS}.
- 넘지 말 선: ${LINES}.
- 돈 액수, 점수 이야기("N점"), 글감.내기록 밖의 기록 이야기("기록했·평균"), 입력에 없는 숫자, 이모지·한자·영문자, 요일·날짜, 반말과 "~십시오".`;

const FACE_WORD: Record<V5Face, string> = { use: "잘 쓸 때", strong: "세질 때", both: "잘 쓸 때 (부담을 곁들임)" };
const POS_WORD = { 일: "나와 가장 가까운 자리", 월: "평소 하는 일과 집안의 자리", 시: "앞으로의 계획의 자리", 연: "오래된 인연의 자리" } as const;
const KIND_WORD = { 충: "부딪힘", 합: "모임", 복음: "같은 글자가 다시 옴" } as const;
const plainName = (tg: TenGod): string => TEN_GOD_PLAIN[tg].짧게;

/** 모델(편집자)에게 보내는 user 메시지 본문. 십신 이름은 싣지 않는다 — 쉬운 이름("경쟁·조바심")만 */
export function renderBriefV5(b: FortuneBrief): string {
  const m = b.v5;
  if (!m) throw new Error("v5 글감이 없는 brief");
  const part = (p: V5Part) => ({ 성격: plainName(p.tenGod), 면: FACE_WORD[p.face], 단락: p.글, ...(p.부담 ? { 부담: p.부담 } : {}) });
  const av = b.plan.avoid;
  const recentDo = (b.avoid.actions ?? []).flatMap((r) => r.lines.slice(0, 1));
  const recentEnd = b.recent.flatMap((r) => r.lines?.slice(-1) ?? []);
  // 같은 성격이 며칠 안에 다시 온 날: 사전 단락이 같으니 그날 나간 문장과 겹치기 쉽다 — 그 문장을 보여 주고 다른 장면으로 풀게 한다
  const mine = [m.core.글, m.core.부담 ?? "", m.other?.글 ?? "", m.연결].join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
  const reused = [...new Set((b.avoid.lines ?? []).flatMap((r) => r.lines).filter((line) => mine.some((s) => tokenOverlap(line, s) >= 0.6)))].slice(0, 6);
  const avoid = {
    ...(av.headlines.length ? { 최근제목: av.headlines } : {}),
    ...(av.openers.length ? { 최근첫어절: av.openers } : {}),
    ...(reused.length ? { 며칠전에쓴문장: reused } : {}),
    ...(recentDo.length ? { 최근하면: recentDo } : {}),
    ...(recentEnd.length ? { 최근마무리: recentEnd } : {}),
  };
  return JSON.stringify({
    단계: `${b.score.band}(${b.score.word})`,
    글감: {
      중심: part(m.core),
      ...(m.other ? { 곁: part(m.other) } : { 겹침: `'${plainName(m.core.tenGod)}' 성격이 두 번 겹쳐 온 날` }),
      둘사이: m.연결,
      ...(m.연결문 ? { 둘사이_보기: m.연결문.예 } : {}),
      ...(m.자리 ? { 닿는자리: { 무엇: `오늘이 ${POS_WORD[m.자리.pos]}와 ${KIND_WORD[m.자리.kind]}`, 단락: m.자리.글 } } : {}),
      ...(m.내기록 ? { 내기록: m.내기록 } : {}),
      마무리: m.마무리,
    },
    장면: [...m.core.장면, ...(m.other ? m.other.장면 : [])],
    ...(m.비유 ? { 비유: `${m.비유.말} — ${m.비유.뜻}` } : {}),
    제목_보기: m.제목보기,
    하면피해요_보기: m.하면피해요.map((a) => `하면: ${a.do} / 피해요: ${a.dont}`),
    끝인사_보기: m.끝인사,
    ...(b.plan.areas.length ? { 영역: b.plan.areas.map((a) => `${a.word}${a.signal} (${areaStateOf(a.area, a.signal as "↑" | "↓")}${a.period !== "오늘" ? `, ${a.period}` : ""})`) } : {}),
    ...(m.넘지말선.length ? { 넘지말선: m.넘지말선 } : {}),
    ...(Object.keys(avoid).length ? { 피할것: avoid } : {}),
    ...(b.caveats.length ? { 참고: b.caveats } : {}),
  });
}

/** v5 프롬프트 판본: 지시 + 사전 판본 (스키마는 llm.ts가 같은 것을 쓴다) */
export const promptVersionV5 = (dict: string): string => `v5.0-${createHash("sha256").update(SYSTEM_V5 + dict).digest("hex").slice(0, 8)}`;
