import { stateSay } from "@/lib/entry";
import type { GroupStateRow, StateAxisSummary, StateTagCount } from "@/lib/stats/states";

interface Props {
  /** 최근 30일, 축마다 세 단계가 몇 번이었나 */
  summary: StateAxisSummary[];
  /** 최근 30일 자주 고른 세부 낱말 */
  tags: StateTagCount[];
  /** 십신 갈래가 온 날의 상태 (내 일간 기준) */
  groups: GroupStateRow[];
}

/** 갈래 이름을 쉬운 말로 */
const GROUP_WORD: Record<string, string> = { 비겁: "내 고집·경쟁", 식상: "표현·여유", 재성: "돈·실속", 관성: "책임·규칙", 인성: "배움·생각" };

/**
 * 나 화면 "있었던 일" 통계 (2026-11-14, 명세 37). 상태 기록이 하나도 없으면 그리지 않는다.
 *  1) 최근 30일: 축마다 세 단계 횟수 ("하루의 속도 — 여유 5 · 보통 9 · 바쁨 12")
 *  2) 글자별: 십신 갈래가 온 날에 그 갈래의 축이 어땠나 ("책임·규칙 기운이 온 날 7번 중 5번 무거웠음"). 표본 5번 미만이면 비율 없이 횟수만.
 * 서버 컴포넌트. 계산은 lib/stats/states.ts.
 * 모양(톤 v3.41, globals.css .state-stats*): 다른 통계와 같은 card-light 카드 한 장. 축 한 줄 = 이름 58px + 붓 가로획 한 줄(세 단계 횟수가 너비,
 * 녹갈 한 색의 세 농도) + 그 아래 세 단계 말과 횟수(왼·가운데·오른 — 막대의 순서 그대로). 횟수 0인 단계는 막대에서 빠지고 말만 흐리게 남는다.
 */
export function StateStats({ summary, tags, groups }: Props) {
  if (!summary.some((s) => s.n > 0)) return null;
  const groupRows = groups.filter((g) => g.top);
  return (
    <section className="state-stats card-frame card-light card-paper px-5 py-4" aria-label="있었던 일 통계">
      <div className="state-stats__head">
        <h3 className="state-stats__title">있었던 일</h3>
        <p className="state-stats__sub">최근 30일</p>
      </div>
      <dl className="state-stats__rows">
        {summary.filter((s) => s.n > 0).map((s) => (
          <div key={s.key} className="state-stats__row" data-axis={s.key}>
            <dt className="state-stats__label">{s.label}</dt>
            <dd className="state-stats__bar" aria-label={s.levels.map((w, i) => `${w} ${s.counts[i]}일`).join(", ")}>
              {/* 붓 한 획: 세 단계가 횟수만큼 너비를 나눠 갖는다 (글자는 아래 줄에) */}
              <span className="state-stats__stroke" aria-hidden>
                {s.levels.map((w, i) => (
                  <span key={w} className="state-stats__seg" data-level={i + 1} style={{ flexGrow: s.counts[i] }} hidden={s.counts[i] === 0} />
                ))}
              </span>
              <span className="state-stats__words">
                {s.levels.map((w, i) => (
                  <span key={w} className="state-stats__word" data-level={i + 1} data-zero={s.counts[i] === 0 ? "" : undefined}>
                    <span className="state-stats__seg-word">{w}</span> <span className="state-stats__seg-n">{s.counts[i]}</span>
                  </span>
                ))}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {tags.length > 0 && (
        <ul className="state-stats__tags" aria-label="자주 있었던 일">
          {tags.map((t) => (
            <li key={t.key} className="tag state-tag">
              {t.label} <span className="state-stats__tag-n">{t.n}</span>
            </li>
          ))}
        </ul>
      )}
      {groupRows.length > 0 && (
        <div className="state-stats__groups">
          <h4 className="state-stats__groups-title">글자별로 보면</h4>
          <ul className="state-stats__group-list">
            {groupRows.map((g) => (
              <li key={g.group} className="state-stats__group" data-group={g.group} data-thin={g.top!.ratio === null ? "" : undefined}>
                <span className="state-stats__group-name">{GROUP_WORD[g.group]} 기운이 온 날</span>{" "}
                <span className="state-stats__group-fact">
                  {g.n}번 중 {g.top!.count}번 <strong>{stateSay(g.axis, g.top!.level)}</strong>
                </span>
                {g.top!.ratio !== null && g.otherRatio !== null && (
                  <span className="state-stats__group-vs"> (다른 날은 {Math.round(g.otherRatio * 100)}%)</span>
                )}
              </li>
            ))}
          </ul>
          {groupRows.some((g) => g.top!.ratio === null) && <p className="state-stats__note">기록이 5번보다 적은 갈래는 횟수만 보여 줘요.</p>}
        </div>
      )}
    </section>
  );
}
