import type { Bucket } from "@/lib/stats/ganji";
import { GlyphButton } from "@/components/GlyphSheet";

/** 굵게 적는 최고 · 최저를 고를 때의 최소 기록 날 수 */
const BOLD_MIN = 3;

/**
 * 세로 막대 한 줄 (Q6 = A). 칸은 늘 전부(천간 10 · 지지 12 · 오행 5) — 자리가 고정돼야 한눈에 비교된다.
 * 막대 높이 = 평균 행복도((mean−1)/9), 위에 평균 숫자, 아래 글자와 기록한 날 수. 기록 없는 칸은 빈 자리 + "-".
 * 오행 줄은 data-el로 오행 색. 모양은 디자이너(.bars*).
 * 명세 52 (톤 v3.56, 앱 주인 "아래에 점수의 의미가 잘 와닿지 않아. 아마 기록한 횟수일 건데 알 수 있게"):
 *   묶음 왼쪽에 줄 이름을 단다 — 막대 위 줄 "평균", 글자 아래 줄 "기록한 날"(지지 열두 칸에는 숫자마다 "일"을 붙일 폭이 없다).
 *   가장 높은 글자와 가장 낮은 글자(각각 기록 3일 이상인 것 가운데)만 막대 위 숫자를 굵게.
 *   칸은 버튼 — 누르면 그 글자가 든 날에 있었던 일의 경향이 낱장으로 뜬다(GlyphSheet). kind = 낱장 열쇠의 앞머리(stem · branch · element).
 */
export function Bars({ title, items, element = false, kind }: { title: string; items: Bucket[]; element?: boolean; kind?: "stem" | "branch" | "element" }) {
  const ranked = items.filter((b) => b.n >= BOLD_MIN && b.mean !== null);
  const hi = ranked.length ? ranked.reduce((a, b) => (b.mean! > a.mean! ? b : a)) : null;
  const lo = ranked.length > 1 ? ranked.reduce((a, b) => (b.mean! < a.mean! ? b : a)) : null;
  return (
    <div className="bars" data-kind={element ? "element" : "ganji"}>
      <p className="bars__title text-[14px] font-bold">{title}</p>
      <div className="bars__body">
        {/* 줄 이름: 위 숫자 = 평균, 아래 숫자 = 기록한 날 */}
        <p className="bars__names" aria-hidden>
          <span>평균</span>
          <span>기록한 날</span>
        </p>
        <ol className="bars__row" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((b) => {
            const pct = b.mean === null ? 0 : Math.max(4, ((b.mean - 1) / 9) * 100);
            const name = element ? b.key : b.ko;
            const peak = b.n > 0 && lo !== hi && (b === hi || b === lo);
            return (
              <li key={b.key}>
                <GlyphButton id={`${kind ?? "none"}:${name}`} className="bars__col" aria-label={`${name} ${b.n ? `평균 ${b.mean}, 기록한 날 ${b.n}일` : "기록 없음"}. 그날 있었던 일 보기`}>
                  <span className="bars__value" data-peak={peak ? "" : undefined}>
                    {b.mean ?? ""}
                  </span>
                  <span className="bars__track" data-empty={b.n ? undefined : ""} data-el={element ? b.key : undefined}>
                    <span className="bars__fill" style={{ height: `${pct}%` }} />
                  </span>
                  <span className="bars__label" data-empty={b.n ? undefined : ""}>
                    {name}
                  </span>
                  <span className="bars__n">{b.n || "-"}</span>
                </GlyphButton>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
