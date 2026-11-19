import type { ReactNode } from "react";
import { SheetTrigger } from "@/components/Sheet";
import { VersusDays } from "@/components/VersusDays";
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
 * "예상은 맞았을까?" 낱장의 안 (명세 47 Q18 → 명세 50 6번, 톤 v3.54). 앱 주인: "글들이 너무 많아서 가독성이 안 좋아. 정렬도 깔끔하게 핵심만 간결하게."
 * 숫자 두 칸(좋을 날로 본 N일 → M일 좋았어요 / 조심할 날로 본 N일 → M일 힘들었어요, 칸 테는 옥색 · 주홍 — 칩과 같은 말씨) → 안내 한 줄 →
 * 세 열로 맞춘 날 목록(VersusDays: 날짜 · 예상 · 내 행복도 도장, 처음 7줄). 큰 문장 둘(versus.sentences)은 화면에 쓰지 않고 읽어 주는 글로만 남긴다.
 * 백분율 · "적중" · 운세 점수 숫자는 쓰지 않는다.
 */
export function VersusAnswer({ versus }: { versus: ForecastVersus }) {
  if (versus.days.length === 0) {
    return (
      <div className="answer">
        <p className="answer__lead" data-empty="">
          아직 견줄 날이 없어요. 운세를 본 날에 기록을 남기면 쌓여요
        </p>
      </div>
    );
  }
  const cells = [
    { kind: "good" as const, head: `좋을 날로 본 ${versus.good.days}일`, days: versus.good.days, big: `${versus.good.good}일`, word: "좋았어요", off: versus.good.hard > 0 ? `${versus.good.hard}일은 힘들었어요` : null },
    { kind: "care" as const, head: `조심할 날로 본 ${versus.caution.days}일`, days: versus.caution.days, big: `${versus.caution.hard}일`, word: "힘들었어요", off: versus.caution.good > 0 ? `${versus.caution.good}일은 오히려 좋았어요` : null },
  ];
  return (
    <div className="answer answer--versus">
      <div className="sr-only">
        {versus.sentences.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
      <ul className="versus-cells" aria-hidden>
        {cells.map((c) => (
          <li key={c.kind} className="versus-cell" data-kind={c.kind}>
            <span className="versus-cell__head">{c.head}</span>
            {c.days === 0 ? (
              <span className="versus-cell__none">아직 없어요</span>
            ) : (
              <span className="versus-cell__big">
                <b>{c.big}</b> {c.word}
              </span>
            )}
            {c.days > 0 && c.off && <span className="versus-cell__off">{c.off}</span>}
          </li>
        ))}
      </ul>
      <p className="answer__note">예상과 내 행복도를 나란히 본 거예요</p>
      <VersusDays days={versus.days} />
    </div>
  );
}
