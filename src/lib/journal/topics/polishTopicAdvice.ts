/**
 * 「지난 30일 화제」 합쳐 조언 — 템플릿 초고의 문맥 이상을 고치고 감성 요약.
 * 운세 polishCopy와 같이 한 번만 호출해 빠르게 끝낸다.
 */
import OpenAI from "openai";

const POLISH_SYSTEM = `당신은 한국어 문장 편집자다.
입력은 일기 앱 "지난 30일 화제" 조언 초고다. 사실을 바꾸지 말고, 문맥이 이상한 곳만 고친 뒤 감성적으로 1~2문장으로 요약하라.

규칙:
- 출력은 본문 1~2문장만. JSON·따옴표·제목·설명 금지.
- 어미: ~이에요 / ~보세요 / ~수 있어요 / ~주세요.
- 앞 문장(돌아봄)과 뒤 문장(조언)의 톤·전제가 서로 모순되면 반드시 고친다.
- 화제 이름을 · 로 나열하거나 "A, B가 등장했어요"처럼 정보를 쌓지 마세요.
- 금지: 점수·수치·진단·예언·의학조언, 공허한 "기운이 느껴져요"만 있는 문장, 만능 공식 마무리.
- 초고의 핵심 의미는 유지하되, 한 흐름으로 읽히게 다시 써라.

나쁜 예 (문맥 모순 — 이렇게 쓰지 말 것):
몸의 리듬을 살피며 컨디션을 조절해 온 한 주였어요. 몸 상태가 좋아도 무리해서 일을 벌이기보다, 한 템포 쉬어가며 속도를 조절해 보세요.

좋은 예 (같은 뜻을 자연스럽게 이음):
몸의 리듬을 살피며 컨디션을 지켜 온 한 주였어요. 그 섬세함을 이어가되, 오늘도 몸 신호를 기준으로 속도를 맞춰 보세요.`;

export async function polishTopicCombinedAdvice(
  draft: string,
  client: OpenAI,
  opts?: { themeLabels?: string; hint?: string }
): Promise<string> {
  const text = draft.replace(/\s+/g, " ").trim();
  if (text.length < 12) return draft;

  const hint = opts?.hint?.replace(/\s+/g, " ").trim().slice(0, 160);
  const labels = opts?.themeLabels?.replace(/\s+/g, " ").trim().slice(0, 80);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_JOURNAL_SCORE_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 200,
      messages: [
        { role: "system", content: POLISH_SYSTEM },
        {
          role: "user",
          content: [
            labels ? `화제 힌트: ${labels}` : null,
            hint ? `일기 조각: ${hint}` : null,
            `초고:\n${text.slice(0, 420)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    const out = completion.choices[0]?.message?.content?.replace(/\s+/g, " ").trim();
    if (!out || out.length < 12) return draft;
    const cleaned = out
      .replace(/^["「]|["」]$/g, "")
      .replace(/^```[\s\S]*?```$/g, "")
      .replace(/\d+(\.\d+)?\s*점/g, "")
      .trim()
      .slice(0, 280);
    return cleaned.length >= 12 ? cleaned : draft;
  } catch {
    return draft;
  }
}
