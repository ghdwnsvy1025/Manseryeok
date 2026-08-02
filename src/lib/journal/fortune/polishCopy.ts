/**
 * 운세 종합 본문 — 문맥 이상·만능 공식을 고치고 3문장으로 간결화.
 * 생성 실패 시 원문 유지.
 */
import OpenAI from "openai";

const POLISH_SYSTEM = `당신은 한국어 문장 편집자다.
입력은 사주 앱의 "오늘의 운세" 초고다. 사실을 바꾸지 말고, 문맥이 이상한 곳만 고친 뒤 정확히 3문장으로 간결히 요약하라.

규칙:
- 출력은 본문 3문장만. JSON·따옴표·제목·설명 금지.
- 어미: ~이에요 / ~보세요 / ~수 있어요.
- 금지: "A와 B가 함께하는 날" 식 추상 나열, "기운이 느껴져요"만 있는 공허한 문장, "이 기운을 통해…따뜻해질 수 있어요" 만능 마무리, 전문 사주 용어.
- 구조: (1) 오늘 커지는 마음 (2) 주의할 결·보는 법 (3) 같은 주제의 작은 행동.
- 초고의 핵심 의미는 유지하되, 읽히게 다시 써라.

좋은 예:
오늘은 자신의 뜻을 분명히 표현하고 싶은 마음이 커지는 날이에요. 주변의 반응에 예민해질 수 있으니, 감정과 사실을 구분해 바라보세요. 솔직하되 부드럽게 의도를 전하면 불필요한 오해를 줄일 수 있어요.`;

export async function polishFortuneOverallCopy(
  draft: string,
  client: OpenAI
): Promise<string> {
  const text = draft.replace(/\s+/g, " ").trim();
  if (text.length < 24) return draft;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 280,
      messages: [
        { role: "system", content: POLISH_SYSTEM },
        {
          role: "user",
          content: `초고:\n${text.slice(0, 900)}`,
        },
      ],
    });
    const out = completion.choices[0]?.message?.content?.replace(/\s+/g, " ").trim();
    if (!out || out.length < 24) return draft;
    // 마크다운·따옴표 감싸기 제거
    const cleaned = out
      .replace(/^["「]|["」]$/g, "")
      .replace(/^```[\s\S]*?```$/g, "")
      .trim();
    return cleaned.length >= 24 ? cleaned : draft;
  } catch {
    return draft;
  }
}
