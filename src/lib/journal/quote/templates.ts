/**
 * 검수된 템플릿 폴백 풀 (주제별)
 */
export const SENTENCE_TEMPLATE_VERSION = "sentence-templates-v1.0.0";

export type SentenceTemplateTheme =
  | "recovery"
  | "stability"
  | "emotion"
  | "relation"
  | "action"
  | "achievement";

export const SENTENCE_TEMPLATES: Record<
  SentenceTemplateTheme,
  string[]
> = {
  recovery: [
    "오늘 잠시 멈춘 숨도, 내일의 리듬을 위한 자리예요.",
    "충분히 애쓴 하루에는 회복도 오늘의 할 일이에요.",
    "지친 마음은 느린 속도로도 이미 앞으로 가고 있어요.",
  ],
  stability: [
    "특별하지 않은 하루에도 나를 지키는 작은 균형이 있어요.",
    "고요한 날의 기록도 내일의 기준이 됩니다.",
    "평온한 하루를 남긴 것만으로도 충분해요.",
  ],
  emotion: [
    "이름 붙이기 어려운 감정도 오늘의 일부로 남아도 괜찮아요.",
    "정리되지 않은 마음도 솔직한 기록의 시작이에요.",
    "느낀 대로 적어 둔 한 줄이 나를 가장 잘 설명해요.",
  ],
  relation: [
    "사람 사이의 거리는 오늘 한 걸음만 조절해도 충분해요.",
    "말한 것과 말하지 않은 것 사이에서도 관계는 이어져요.",
    "오늘의 마음은 천천히 건네도 늦지 않아요.",
  ],
  action: [
    "완벽한 마무리보다, 오늘 끝낸 한 가지가 더 소중해요.",
    "작은 실행 하나가 내일의 부담을 덜어줍니다.",
    "할 일을 줄인 선택도 오늘의 성과예요.",
  ],
  achievement: [
    "잘한 순간을 짧게라도 남겨 두면 내일이 가벼워져요.",
    "오늘의 작은 성과도 충분히 기록될 가치가 있어요.",
    "애쓴 흔적을 인정하는 일이 다음 힘을 만듭니다.",
  ],
};

export function pickTemplateSentence(
  theme: SentenceTemplateTheme,
  recent: string[] = []
): string {
  const pool = SENTENCE_TEMPLATES[theme];
  const fresh = pool.filter((s) => !recent.includes(s));
  const list = fresh.length > 0 ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)] ?? pool[0]!;
}

export function inferTemplateTheme(opts: {
  moods: string[];
  lowEnergy?: boolean;
  hardDay?: boolean;
  goodDay?: boolean;
  overload?: boolean;
}): SentenceTemplateTheme {
  if (opts.hardDay || opts.lowEnergy) return "recovery";
  if (opts.overload) return "action";
  if (opts.goodDay) return "achievement";
  if (opts.moods.some((m) => m === "평온" || m === "무덤덤")) return "stability";
  if (opts.moods.some((m) => ["슬픔", "불안", "분노", "지침"].includes(m))) {
    return "emotion";
  }
  return "emotion";
}
