// v4.5: SYSTEM 안 예시 세 편. llm.ts가 프롬프트에 넣고, validate.ts가 "예시를 베꼈는가"를 본다 (순환 import를 피해 따로 둔다).
// v4.15 (2026-10-23, 사주 코어 블록 방식): 본문은 네 블록 — 근거(이름·뜻·맞는지) · 원리 또는 성향 · 사례("예를 들면", 그날 무대 안) · 처방(언제 + 무엇).
//   순서는 날마다 다르고 처방은 맨 앞이 아니다. 이달 한 줄은 본문에서 빠졌다(areas의 이달 줄이 말한다). 세 편 모두 검사기를 통과한다(테스트).
export type BlockKind = "근거" | "원리" | "성향" | "사례" | "처방";
export interface FortuneBlock { kind: BlockKind; text: string }

export interface FortuneExample {
  band: "좋음" | "무난" | "주의";
  facts: string;
  /** 이 예시가 가정한 오늘 기운 이름 (brief.today.tenGods 꼴). 테스트가 brief에 넣어 검사한다 */
  tenGods: string;
  /** v4.15: 이 예시의 사례 무대 이름 (brief.stage.name). 테스트가 brief에 넣어 검사한다 */
  stage: string;
  /** body는 blocks에서 만든 것(joinBlocks) — 테스트·검사기가 옛 꼴(body)로도 읽을 수 있게 둘 다 둔다 */
  text: { headline: string; blocks: FortuneBlock[]; body: string; areas: []; do: string; dont: string };
}

/** v4.15: 블록 → 화면용 본문. 앞 두 블록이 첫 문단, 뒤 두 블록이 둘째 문단 (카드는 "\n\n"으로 문단을 나눈다) */
export function joinBlocks(blocks: readonly FortuneBlock[]): string {
  const texts = blocks.map((b) => String(b?.text ?? "").trim()).filter(Boolean);
  if (texts.length <= 2) return texts.join(" ");
  const cut = Math.ceil(texts.length / 2);
  return `${texts.slice(0, cut).join(" ")}\n\n${texts.slice(cut).join(" ")}`;
}

const withBody = (t: Omit<FortuneExample["text"], "body">): FortuneExample["text"] => ({ ...t, body: joinBlocks(t.blocks) });
export const FORTUNE_EXAMPLES: FortuneExample[] = [
  {
    band: "좋음",
    facts: "오늘 임술일 편관(압박과 책임)·식신(표현과 여유), 내게 모자란 금(실속을 챙기는 힘)을 거듦 → 맞는 편 · 돈 쪽 신호 · 무대 돈",
    tenGods: "편관·식신",
    stage: "돈",
    text: withBody({
      headline: "미뤄 둔 돈 정리가 손에 잡히는 날",
      blocks: [
        { kind: "근거", text: "오늘 임술일에는 압박과 책임을 뜻하는 편관과 표현과 여유를 뜻하는 식신이 함께 와요. 둘 다 내게 모자란 금, 그러니까 실속을 챙기는 힘을 거드는 쪽이라 오늘은 맞는 편이에요." },
        { kind: "성향", text: "해야 할 일이 무겁게 느껴지기보다 하나씩 끝내고 싶은 마음이 앞서요." },
        { kind: "사례", text: "예를 들면 미뤄 둔 공과금을 내거나 안 쓰는 물건을 중고로 올리는 일이 평소보다 쉽게 손에 잡혀요." },
        { kind: "처방", text: "정리가 끝난 저녁에는 남은 돈이 얼마인지 한 줄만 적어 둬요." },
      ],
      areas: [],
      do: "자기 전에 지갑과 통장 잔액을 한 번 맞춰 봐요.",
      dont: "돈이 보인다고 그 자리에서 큰 걸 사지 않아요.",
    }),
  },
  {
    band: "무난",
    facts: "오늘 계해일 정관(약속과 역할)·편관(압박과 책임), 내게 모자란 금도 넉넉한 기운도 아님 → 보통 · 무대 말",
    tenGods: "정관·편관",
    stage: "말",
    text: withBody({
      headline: "정해진 일만 지키면 되는 하루",
      blocks: [
        { kind: "사례", text: "예를 들면 미뤄 둔 답장 하나를 보내고 나면 나머지 할 일이 또렷하게 줄을 서요." },
        { kind: "근거", text: "오늘 계해일에는 약속과 역할을 뜻하는 정관과 압박과 책임을 뜻하는 편관이 함께 들어와요. 둘 다 내게 모자란 금도 이미 넉넉한 기운도 아니라서 오늘은 어느 쪽으로도 기울지 않는 보통 날이에요." },
        { kind: "원리", text: "정관은 정해진 틀 안에서 움직일 때 편해지는 힘이라, 오늘은 새로 벌이기보다 맡은 것을 지키는 쪽이 수월해요." },
        { kind: "처방", text: "남의 몫까지 떠안고 싶어질 때는 내 할 일 하나만 먼저 끝내요." },
      ],
      areas: [],
      do: "자기 전에 내일 할 일 두 가지만 적어 둬요.",
      dont: "체면 때문에 남의 일을 떠맡지 않아요.",
    }),
  },
  {
    band: "주의",
    facts: "오늘 정사일 겁재(경쟁과 추진)·비견(내 속도), 화는 내게 이미 넉넉한 기운 → 안 맞는 편 · 가까운 사람 쪽 일정이 흔들림 · 무대 사람",
    tenGods: "겁재·비견",
    stage: "사람",
    text: withBody({
      headline: "내 뜻대로 밀고 싶어지는 날",
      blocks: [
        { kind: "근거", text: "오늘 정사일에는 경쟁과 추진을 뜻하는 겁재와 내 속도를 뜻하는 비견이 화 기운으로 같이 와요. 화는 내게 이미 넉넉한 기운이라 오늘은 안 맞는 날이에요." },
        { kind: "성향", text: "그래서 내 뜻대로 밀고 싶은 마음만 평소보다 세지고 남 말이 잘 안 들려요." },
        { kind: "사례", text: "예를 들면 가까운 사람과 잡아 둔 저녁 약속이 갑자기 바뀌면 괜히 서운해져 말이 세게 나가기 쉬워요." },
        { kind: "처방", text: "그럴 때는 바로 답하지 말고 숨을 한 번 고른 뒤에 짧게만 말해요." },
      ],
      areas: [],
      do: "서운한 말이 나올 것 같으면 먼저 물 한 잔 마시고 와요.",
      dont: "약속이 바뀌었다고 그 자리에서 따지지 않아요.",
    }),
  },
];
