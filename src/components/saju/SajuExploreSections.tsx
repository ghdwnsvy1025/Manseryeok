"use client";

import { useState } from "react";
import { MOCK_EASY_SAJU_CARDS } from "@/mocks/users";
import EmptyState from "@/components/product/EmptyState";

type SectionTab = "easy" | "study" | "dictionary";

const DICTIONARY_ITEMS = [
  { key: "천간", body: "하루의 하늘 기운. 방향과 태도를 보여줍니다." },
  { key: "지지", body: "하루의 땅 기운. 환경과 리듬을 보여줍니다." },
  { key: "십신", body: "내 일간을 기준으로 본 관계의 역할입니다." },
  { key: "오행", body: "목·화·토·금·수 기운의 균형입니다." },
];

type Props = {
  hasProfile: boolean;
};

export default function SajuExploreSections({ hasProfile }: Props) {
  const [tab, setTab] = useState<SectionTab>("easy");

  return (
    <section className="space-y-3" aria-label="내 사주 탐색">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["easy", "쉬운 사주"],
            ["study", "공부"],
            ["dictionary", "사전"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="px-2 py-1 text-xs font-bold border"
            style={{
              borderColor: tab === id ? "var(--px-accent)" : "var(--px-border)",
              color: tab === id ? "var(--px-accent)" : "var(--px-text2)",
            }}
            aria-pressed={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasProfile && (
        <EmptyState
          title="사주를 먼저 연결해 주세요"
          description="연결 없이도 일반 이론은 볼 수 있어요."
          actionLabel="사주 등록"
          actionHref="#saju-form"
        />
      )}

      {tab === "easy" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {MOCK_EASY_SAJU_CARDS.map((card) => (
            <div
              key={card.id}
              className="p-3 border-2 space-y-1"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
            >
              <p className="text-xs font-black" style={{ color: "var(--px-accent)" }}>
                {card.title}
              </p>
              <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
                {card.body}
              </p>
              <p className="ui-hint">목업 해석입니다. 나중에 개인 해석으로 교체됩니다.</p>
            </div>
          ))}
        </div>
      )}

      {tab === "study" && (
        <div
          className="p-3 border-2 space-y-2"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        >
          <p className="ui-section-title">오늘의 학습 카드</p>
          <p className="text-sm">
            일반적으로 편재는 외부 활동, 유동적인 재물, 다양한 관계와 연결될 수 있어요.
          </p>
          <p className="ui-hint">
            내 기록에서는 데이터가 쌓이면 이론과 실제가 일치한 부분을 함께 보여드려요.
          </p>
          <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            확인 질문: 오늘은 사람·약속·이동이 늘었나요?
          </p>
        </div>
      )}

      {tab === "dictionary" && (
        <div className="space-y-2">
          {DICTIONARY_ITEMS.map((item) => (
            <details
              key={item.key}
              className="border-2 p-2"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            >
              <summary className="cursor-pointer text-sm font-bold">{item.key}</summary>
              <p className="mt-2 text-xs" style={{ color: "var(--px-text2)" }}>
                {item.body}
              </p>
              <p className="ui-hint mt-1">내 기록 수 · 평균 행복도 · 자주 나타난 감정은 추후 연결됩니다.</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
