import type { Bucket } from "@/lib/stats/ganji";

/**
 * 세로 막대 한 줄 (Q6 = A). 칸은 늘 전부(천간 10 · 지지 12 · 오행 5) — 자리가 고정돼야 한눈에 비교된다.
 * 막대 높이 = 평균 행복도((mean−1)/9), 위에 평균 숫자, 아래 글자와 횟수. 기록 없는 칸은 빈 자리.
 * 오행 줄은 data-el로 오행 색. 모양은 디자이너(.bars*).
 */
export function Bars({ title, items, element = false }: { title: string; items: Bucket[]; element?: boolean }) {
  return (
    <div className="bars" data-kind={element ? "element" : "ganji"}>
      <p className="bars__title text-[14px] font-bold">{title}</p>
      <ol className="bars__row" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((b) => {
          const pct = b.mean === null ? 0 : Math.max(4, ((b.mean - 1) / 9) * 100);
          return (
            <li key={b.key} className="bars__col" data-empty={b.n ? undefined : ""} data-el={element ? b.key : undefined} aria-label={`${b.ko} ${b.n ? `평균 ${b.mean}, ${b.n}번` : "기록 없음"}`}>
              <span className="bars__value">{b.mean ?? ""}</span>
              <span className="bars__track">
                <span className="bars__fill" style={{ height: `${pct}%` }} />
              </span>
              <span className="bars__label">{element ? b.key : b.ko}</span>
              <span className="bars__n">{b.n || ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

