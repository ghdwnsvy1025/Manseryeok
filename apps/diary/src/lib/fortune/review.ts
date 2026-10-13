// v4.10(2026-10-14): 문맥 검수 — 검사(validate.ts)를 통과한 글을 편집자 역할의 모델이 한 번 더 읽고 비약·끊김·가리킴·어긋남·뻔한말만 찾는다.
// 사주 코어 content/src/문맥.ts와 같은 생각. 낱말 검사기는 "그래서 앞뒤가 안 이어짐", "아무 날에나 맞는 말"을 못 잡는다.
// 기본은 꺼져 있다(호출이 하루 사용자마다 늘어 비용이 두 배가 되므로). 환경변수 FORTUNE_REVIEW_MODEL(예: claude-haiku-4-5-20251001)을 적으면 켜진다.
// 문제가 있으면 같은 brief에 문제를 붙여 한 번 더 쓰게 하고, 고친 글도 같은 검사를 통과할 때만 쓴다. 검수가 실패해도 초고는 그대로 살아 있다.
import type { FortuneBrief } from "./brief";
import type { ModelText } from "./validate";

export type ReviewProblem = { 종류: "비약" | "끊김" | "가리킴" | "어긋남" | "뻔한말"; 인용: string; 왜: string; 고칠방향: string };
const KINDS = new Set(["비약", "끊김", "가리킴", "어긋남", "뻔한말"]);
export const MAX_PROBLEMS = 4;
const squash = (s: string) => s.replace(/\s+/g, "");

/** 검수 모델. 비어 있으면 검수하지 않는다 */
export const reviewModel = (): string | null => process.env.FORTUNE_REVIEW_MODEL?.trim() || null;

export const REVIEW_SYSTEM = `당신은 한국어 편집자입니다. 일기 앱의 오늘의 운세 한 편을 검수합니다. 고치지 말고 문제만 찾습니다. 아래 다섯 가지만 봅니다.
1. 비약: 앞 문장에서 말하지 않은 내용으로 결론을 냄. '그래서·그러니·그러다 보니' 앞뒤가 원인과 결과로 이어지지 않음.
2. 끊김: 문장이나 문단 사이에 연결이 없어 갑자기 다른 이야기로 넘어감. 둘째 문단 첫 문장이 앞 문단을 받지 않음. 새 장면이 예고 없이 튀어나옴.
3. 가리킴: '그·그것·그 마음·이런 날'이 무엇을 가리키는지 바로 앞에서 알 수 없음. 주어가 없어 누가 하는 일인지 흐림.
4. 어긋남: 같은 글 안에서 앞뒤가 반대말을 함(본문은 '서두르지 말라'인데 do는 '바로 연락하라'). headline·body·do·dont가 서로 다른 날 이야기를 함. 핵심(brief의 뼈대 한 줄)과 반대 방향.
5. 뻔한말: 마무리 문장·do·dont가 이 날의 성격(핵심)과 이어지지 않고 아무 날에나 맞는 말('오늘도 힘내요', '마음을 편히 가져요', '무리하지 않아요'). 이 글의 앞 문장들이 없어도 성립하면 뻔한말.
[보지 않는 것] 사주 사실의 맞고 틀림, 말투, 길이, 낱말 취향, 맞춤법. 이런 것은 적지 않습니다.
문제가 없으면 빈 목록을 냅니다. 억지로 찾지 않습니다. 정말 읽다가 걸리는 곳만, 많아야 넷.
'인용'은 글에 있는 문장을 글자 그대로(15자 안팎) 옮깁니다. 글에 없는 말을 인용하면 그 문제는 버려집니다.
'고칠방향'은 사실을 더하거나 빼지 않고 잇는 방법 한 줄입니다(이음말 바꾸기, 가리키는 말을 명사로, 빠진 한 걸음 채우기, 뻔한 마무리를 핵심에서 나온 행동으로).
출력은 JSON 하나만: {"문제":[{"종류":"비약|끊김|가리킴|어긋남|뻔한말","인용":"...","왜":"한 줄","고칠방향":"한 줄"}]}  다른 글자를 앞뒤에 붙이지 마세요.`;

export function reviewUser(t: ModelText, b: FortuneBrief): string {
  return [
    `[오늘] ${b.today.ganji} · ${b.score.band} · 짜임 ${b.angle}`,
    ...(t.핵심 ? [`[핵심 — 작가가 먼저 정한 한 줄] ${t.핵심}`] : []),
    "[글]", `headline: ${t.headline}`, `body: ${t.body}`,
    ...t.areas.map((a) => `areas(${a.period ?? ""} ${a.area}): ${a.line}`),
    `do: ${t.do}`, `dont: ${t.dont}`,
  ].join("\n");
}

/** 편집자 답 → 문제 목록. 형식이 깨졌거나 글에 없는 인용이면 그 문제는 버림 */
export function parseReview(raw: string, t: ModelText): ReviewProblem[] {
  const a = raw.indexOf("{"), z = raw.lastIndexOf("}"); if (a < 0 || z <= a) return [];
  let j: { 문제?: unknown }; try { j = JSON.parse(raw.slice(a, z + 1)); } catch { return []; }
  if (!Array.isArray(j.문제)) return [];
  const text = squash([t.headline, t.body, ...t.areas.map((x) => x.line), t.do, t.dont].join(" "));
  const seen = new Set<string>();
  return (j.문제 as Record<string, unknown>[])
    .filter((x) => x && KINDS.has(String(x.종류)) && typeof x.인용 === "string" && x.인용.trim().length >= 4 && text.includes(squash(x.인용)) && !seen.has(squash(x.인용)) && seen.add(squash(x.인용)))
    .slice(0, MAX_PROBLEMS)
    .map((x) => ({ 종류: x.종류 as ReviewProblem["종류"], 인용: String(x.인용).trim(), 왜: String(x.왜 ?? "").trim(), 고칠방향: String(x.고칠방향 ?? "").trim() }));
}

export const problemLine = (p: ReviewProblem): string => `[${p.종류}] "${p.인용}"${p.왜 ? ` — ${p.왜}` : ""}${p.고칠방향 ? ` → ${p.고칠방향}` : ""}`;

/** 작가에게 돌려보낼 user 메시지 — 그 문제만 고치고 나머지는 그대로. 길이 한도를 같이 적는다(한 걸음을 채우면 글이 늘어 검사에 걸림) */
export function reviewRewriteContent(briefJson: string, prev: ModelText, problems: ReviewProblem[], bodyMax: number): string {
  return `${briefJson}\n\n[편집자가 먼저 쓴 글을 검수했습니다. 아래 문제만 고치고 나머지 문장·사실·숫자는 그대로 두세요. 사실을 더하거나 빼지 않습니다. 고친 글 전체를 같은 JSON 형식으로 다시 씁니다]\n- ${problems.map(problemLine).join("\n- ")}\n- 길이: body는 4~6문장·${bodyMax}자 이내(지금 ${prev.body.length}자). 한 걸음을 채우느라 늘어나면 그만큼 다른 문장을 줄입니다.\n먼저 쓴 글: ${JSON.stringify(prev)}`;
}
