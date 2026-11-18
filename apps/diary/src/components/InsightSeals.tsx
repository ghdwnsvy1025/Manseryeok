import type { ReactNode } from "react";
import { SheetTrigger } from "@/components/Sheet";
import { GROUP_MIN_DAYS, type ForecastVersus, type HappyWhen } from "@/lib/stats/insight";

/** "2026-11-23" → "11.23" */
const shortDate = (date: string): string => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

/**
 * 나 탭 물음 인장 둘 (명세 47, 톤 v3.51): "나는 언제 행복했지?" · "예상은 맞았을까?" — 통계를 늘어놓지 않고 궁금한 것에 답한다.
 * 운세 카드의 인장(네모 테 + 명조 글자)을 버튼 크기로 키운 것, 나란히 두 칸. 좋음 · 조심의 뜻이 없는 물음이라 옥색 · 주홍이 아니라 먹.
 * 잠김(기록 7일 전): 옅은 테 + "기록 7일이면 열려요", 눌러도 열리지 않는다. 열림: 누르면 답 낱장(Sheet)이 올라온다.
 */
export function InsightSeals({ open, left }: { open: boolean; /** 열릴 때까지 남은 기록 날 수 */ left: number }) {
  const seals = [
    { target: "sheet-happy", lines: ["나는 언제", "행복했지?"] },
    { target: "sheet-versus", lines: ["예상은", "맞았을까?"] },
  ];
  return (
    <section className="ask-seals" aria-label="내 기록에 묻기">
      {seals.map((s) => (
        <SheetTrigger key={s.target} target={s.target} locked={!open} className="ask-seal" aria-label={`${s.lines.join(" ")}${open ? "" : `, 기록 7일이면 열려요. ${left}일 남았어요`}`}>
          <span className="ask-seal__q">
            {s.lines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </span>
          {!open && <span className="ask-seal__lock">기록 7일이면 열려요</span>}
        </SheetTrigger>
      ))}
    </section>
  );
}

/**
 * "나는 언제 행복했지?" 낱장의 안 (명세 47 Q17 → 명세 49, 톤 v3.53): 두 날(가장 행복했던 날 · 힘들었던 날) → 행복도 그래프 → 괘선 → "어떤 날에 행복했나".
 * 앱 주인: "표현하는 기운~책임의 기운 값이 있는데 이게 뭔지 모르겠어" — 줄마다 그런 날이 어떤 날인지(hint)를 큰 글씨로, 갈래 낱말(word)은 작게,
 * 숫자 앞에는 반드시 "평균". 막대는 그대로(평균, 10이 끝 — 1등만 옥색). 3일 미만인 줄은 옅게, 평균 대신 "N일뿐이라 아직 몰라요".
 */
export function HappyAnswer({ happy, days, chart }: { happy: HappyWhen; /** 두 날 (BestWorstDays) */ days: ReactNode; /** 행복도 그래프 (HappinessChart variant="happy") */ chart: ReactNode }) {
  return (
    <div className="answer">
      {days}
      <div className="answer__graph">{chart}</div>
      <section className="answer__when" aria-labelledby="happy-when-title">
        <h3 id="happy-when-title" className="answer__h">
          어떤 날에 행복했나
        </h3>
        <p className="answer__how">날마다 들어오는 기운이 달라요. 기운별로 그날의 내 행복도를 평균 냈어요</p>
        <p className="answer__lead" data-empty={happy.sentence ? undefined : ""}>
          {happy.sentence ?? "아직 뚜렷한 차이가 없어요. 기록이 더 쌓이면 보여요"}
        </p>
        <ol className="group-rows" aria-label="들어온 기운별 내 행복도 평균">
          {happy.rows.map((r) => {
            const thin = r.n < GROUP_MIN_DAYS || r.avg === null;
            const top = happy.top?.group === r.group;
            return (
              <li key={r.group} className="group-row" data-thin={thin ? "" : undefined} data-top={top ? "" : undefined}>
                <span className="group-row__what">
                  <span className="group-row__hint">{r.hint}</span>
                  <span className="group-row__word">{r.word}</span>
                </span>
                {thin ? (
                  <span className="group-row__few">{r.n === 0 ? "아직 그런 날의 기록이 없어요" : `${r.n}일뿐이라 아직 몰라요`}</span>
                ) : (
                  <span className="group-row__nums">
                    <span className="group-row__avg">
                      <small>평균</small>
                      {r.avg}
                    </span>
                    <span className="group-row__n">{r.n}일</span>
                  </span>
                )}
                <span className="group-row__track" aria-hidden>
                  {!thin && <span className="group-row__fill" style={{ width: `${Math.max(4, (r.avg! / 10) * 100)}%` }} />}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="answer__foot">하루에 두 기운이 같이 들어오기도 해서, 날 수를 더하면 기록한 날보다 많아요</p>
      </section>
    </div>
  );
}

/**
 * "예상은 맞았을까?" 낱장의 안 (명세 47 Q18): 문장 → 작은 글씨 한 줄 → 날 목록(최근 10).
 * 그래프는 뺐다(2026-11-17 후속, 앱 주인 "추천대로"): 기록이 띄엄띄엄하면 행복도 선이 토막 나 읽히지 않고, 답은 문장과 목록이 이미 말한다.
 * 백분율 · "적중" · 운세 점수 숫자는 쓰지 않는다. 같은 쪽이었던 날에만 옥색 작은 도장, 다른 쪽이었던 날은 표시 없음(틀렸다는 표시를 하지 않는다).
 */
export function VersusAnswer({ versus }: { versus: ForecastVersus }) {
  const days = versus.days.slice(0, 10);
  return (
    <div className="answer">
      {versus.sentences.length > 0 ? (
        <div className="answer__lead">
          {versus.sentences.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      ) : (
        <p className="answer__lead" data-empty="">
          아직 견줄 날이 없어요. 운세를 본 날에 기록을 남기면 쌓여요
        </p>
      )}
      <p className="answer__note">사주로 본 예상과 내가 매긴 행복도를 나란히 놓은 거예요. 맞히기 시합이 아니에요</p>
      {days.length > 0 && (
        <ol className="versus-days" aria-label="예상과 내 기록, 최근 날부터">
          {days.map((d) => (
            <li key={d.date} className="versus-day" data-hit={d.hit ? "" : undefined}>
              <span className="versus-day__date">{shortDate(d.date)}</span>
              <span className="versus-day__band">{d.band === "좋음" ? "좋을 날로 봄" : "조심할 날로 봄"}</span>
              <span className="versus-day__arrow" aria-hidden>
                →
              </span>
              <span className="versus-day__h">행복도 {d.happiness}</span>
              {d.hit ? <span className="versus-day__mark" role="img" aria-label="같은 쪽이었어요" /> : <span className="versus-day__mark" aria-hidden />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
