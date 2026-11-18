import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO } from "@saju/engine";
import { VoteButtons } from "@/components/VoteButtons";
import { FortuneViewTrack } from "@/components/track/FortuneViewTrack";
import Link from "next/link";
import { gaewoonOf } from "@/lib/fortune/gaewoon";
import { SignalLegend } from "@/components/SignalLegend";
import { AREA_WORD } from "@/lib/fortune/core";
import { areaScoreView, dayShapeView, flowNumber, sixAreaView } from "@/lib/fortune/areaProfile";
import { AreaSignalGrid } from "@/components/AreaSignalGrid";
import type { AreaSignal, FortuneContent } from "@/lib/fortune/types";
import type { FortuneRecall } from "@/lib/fortune/recall";
import { happinessTier } from "@/lib/entry";

/** 화살표 색: ↑ 금색(사용자 결정 2026-10-15, v3.26 예외), → 보조, ↓ 먹색. 빨강 없음 (톤 결정표 "길흉을 색으로 말하지 않는다") */
const SIGNAL_COLOR: Record<AreaSignal, string> = { "↑": "text-gold font-bold", "→": "text-muted", "↓": "text-ink" };
const SIGNAL_WORD: Record<AreaSignal, string> = { "↑": "좋아요", "→": "보통이에요", "↓": "조심해요" };
type Period = "오늘" | "이달" | "올해";

/** 한자 천간·지지 → 한글 (근거 문장 병기용). 표시만 바꾼다 — 데이터는 그대로 */
const HANJA_KO: Record<string, string> = {};
STEMS.forEach((h, i) => (HANJA_KO[h] = STEMS_KO[i]));
BRANCHES.forEach((h, i) => (HANJA_KO[h] = BRANCHES_KO[i]));
const HANJA_RE = /(?<![(甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]?|[子丑寅卯辰巳午未申酉戌亥])/g;

/** "癸未" → "계미(癸未)", "癸" → "계(癸)". 이미 "계미(癸未)"처럼 괄호 안이면 건드리지 않는다 */
export function annotateHanja(text: string): string {
  return text.replace(HANJA_RE, (m) => `${[...m].map((c) => HANJA_KO[c] ?? c).join("")}(${m})`);
}

/** 받침 유무 — 조사 고르기 */
function batchim(s: string): boolean {
  const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/**
 * 본문 문단 나누기 (02 v3.7). 기능 쪽이 `\n\n`을 넣어 주면 그대로, 없으면 문장 단위(". " / "요. " 뒤)로 2문장씩 끊는다.
 * 4~6문장 → 2~3문단. 빈 조각은 버린다.
 */
export function splitParagraphs(body: string): string[] {
  const text = body.trim();
  if (!text) return [];
  if (text.includes("\n\n")) return text.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) out.push(sentences.slice(i, i + 2).join(" "));
  return out;
}

/**
 * "내 기록으로 본 오늘" 문장 (02 v3.2). 컴포넌트에서 조립한다.
 * 같은 간지 기록이 있으면 "계축일에 N번 기록 · 평균 M", 없으면 "계나 축이 든 날에 N번 · 평균 M",
 * 둘 다 없으면 "아직 기록이 없어 사주만으로 계산했어요".
 * 비교 문장은 |M×(10/9) − score| ≥ 1.5일 때만.
 */
function personalLines(fortune: FortuneContent, ganjiKo: string): { main: string; compare: string | null; mean: number | null; count: number } {
  const p = fortune.personal;
  const stem = ganjiKo.slice(0, 1);
  const branch = ganjiKo.slice(1);
  let main: string;
  let mean: number | null = null;
  if (p.sameGanjiCount > 0 && p.sameGanjiMean !== null) {
    mean = p.sameGanjiMean;
    main = `${ganjiKo}일 기록 ${p.sameGanjiCount}번 기준`;
  } else if (p.n > 0 && p.mean !== null) {
    mean = p.mean;
    main = `${stem}${batchim(stem) ? "이나" : "나"} ${branch}${batchim(branch) ? "이" : "가"} 든 날 기록 ${p.n}번 기준`;
  } else {
    return { main: "아직 기록이 없어 사주만으로 계산했어요", compare: null, mean: null, count: 0 };
  }
  return { main, compare: null, mean, count: p.sameGanjiCount > 0 && p.sameGanjiMean !== null ? p.sameGanjiCount : p.n };
}

/**
 * 인장안 정돈(명세 39) — 보이는 글자는 그대로 두고 줄바꿈만 막는다. 제목을 두 줄로 고르게 나누는 `text-wrap: balance`가
 * 가운뎃점 앞에서 줄을 끊어("…일 / ·공부 …") 점이 줄 머리에 오는 것을 실측으로 확인했다. 점 양옆에 낱말 이음표(U+2060, 폭 없음)를 넣는다
 */
const joinDots = (text: string) => text.replace(/·/g, "⁠·⁠");

interface Props {
  fortune: FortuneContent;
  /** 날짜 ("10월 5일"). v3.7부터 카드 머리에 쓰지 않는다 — 제목과 중복. 호출부 호환으로 남겨 둔다 */
  dateLabel?: string;
  /** 카드 머리에 들어가는 간지 한글 ("임자"). 글자로만 쓴다 (그림 없음, v3.3) */
  ganjiKo: string;
  /** 로그인한 사용자만 투표할 수 있다 */
  canVote: boolean;
  vote: 1 | -1 | null;
  /** 기본으로 펼쳐 둘지 */
  defaultOpen: boolean;
  /** 이 운세를 만든 계산 버전("v4.18") — 카드 맨 아래 작게. 판정이 바뀐 뒤 새로 만든 운세인지 사용자가 알 수 있게 (2026-10-31) */
  version?: string;
  /**
   * 2026-11-14 카드 시험 (명세 38): story = 지금 카드(기본) · seal = 1안 "핵심 한 문장 + 특성 인장" · score = 2안 "핵심 한 문장 + 영역 점수".
   * seal·score에서는 긴 본문이 "풀어서 읽기" 안으로 접힌다. 아직 화면(page.tsx)에서 넘기지 않는다 — 앱 주인이 스크린샷으로 고른 뒤 정한다
   */
  variant?: "story" | "seal" | "score";
  /** 2026-11-15 (명세 41): 지난 기록의 사실 — 같은 일진이던 날, 같은 성격 갈래가 온 날의 경향(두 번 이상만). recall.ts가 만든다. 없으면 그리지 않는다 */
  recall?: FortuneRecall | null;
  /**
   * 2026-11-15 (명세 42 B): 등불 톤 시안 — 인장안(variant="seal")에서만 걸린다. 켜지면 최상위에 `fc--lantern`, 머리에 남색 문양 띠와 술 장식(aria-hidden).
   * 앱 주인이 그림으로 고르기 전까지 page.tsx는 넘기지 않는다. 모양은 디자이너(.fc--lantern …)
   * 2026-11-15 (명세 43): 도화 톤(`dohwa` → `fc--dohwa`)과 등불+도화 섞은 톤(`blend` → `fc--blend`) 시안. 역시 인장안에서만, page.tsx는 넘기지 않는다.
   * 장식(테 · 띠 · 매듭과 술 · 그날 일진 한자 워터마크)은 전부 aria-hidden이고 자리를 차지하지 않는다. 모양은 디자이너(.fc--dohwa · .fc--blend …)
   */
  theme?: "lantern" | "dohwa" | "blend";
}

/**
 * 도화·섞은 톤 시안(명세 43)의 워터마크 — 그날 일진 한글("임자")을 한자 두 글자(["壬", "子"])로. 표시만 바꾼다(데이터는 그대로).
 * 카드가 이미 받는 ganjiKo에서 얻으므로 새 prop이 필요 없다. 한글이 천간·지지가 아니면 null(워터마크 없음)
 */
function dayHanja(ko: string): [string, string] | null {
  const s = (STEMS_KO as readonly string[]).indexOf(ko.slice(0, 1));
  const b = (BRANCHES_KO as readonly string[]).indexOf(ko.slice(1, 2));
  return s >= 0 && b >= 0 ? [STEMS[s], BRANCHES[b]] : null;
}

/**
 * 인장안 영역 가로 게이지(명세 42 A): 줄마다 왼쪽 0에서 gauge(0~100, 50 = 보통)까지 한 방향으로 채운다.
 * 줄 동작(누르면 이유가 펼쳐짐·이용 통계)은 AreaSignalGrid 그대로 쓰고, 이 함수는 줄 순서대로 채움 길이와 색 갈래만 CSS 변수로 넘긴다
 * (--fc-g-N = 길이 %, --fc-gc-N = 높음 / 낮음 / 신호 없음 흐린 50 — 색은 톤마다: 기본 금빛 · 남색, 섞은 톤 옥색 · 주홍(명세 46)). 숫자는 화면에 쓰지 않는다 — 점수가 아니라 신호 세기다
 */
function gaugeVars(rows: readonly { gauge: number }[]): React.CSSProperties {
  const vars: Record<string, string> = {};
  rows.forEach((r, i) => {
    vars[`--fc-g-${i + 1}`] = `${r.gauge}%`;
    vars[`--fc-gc-${i + 1}`] = r.gauge > 50 ? "var(--fc-gauge-up)" : r.gauge < 50 ? "var(--fc-gauge-down)" : "var(--fc-gauge-none)";
  });
  return vars as React.CSSProperties;
}

/**
 * 오늘의 운세. 한지 카드에 금색 이중 테두리 (톤 v3.1 — 밤 패널 없음).
 * 이 화면에서 그림이 있는 카드는 이것뿐: 머리 오른쪽에 그날 일진의 동물(바이럴 60갑자 세트) 하나.
 * 닫혀 있어도 날짜·간지와 밴드 단어·점수까지는 보이고, 본문은 열어야 보인다 (v3.4: 눈금 없음, 숫자가 주인공).
 * 접힘/펼침은 details 요소로 처리해 자바스크립트 없이도 열린다.
 * 열리는 전환은 globals.css의 .fortune-body (디자인 명세 02).
 * v3.2: 본문 아래 "내 기록으로 본 오늘" 블록, 맨 아래 "왜 이런 운세인가요?" details.
 * v3.4: 영역 줄(오늘/이달/올해)과 하면/피해요가 "오늘의 신호" 상자 하나에 같은 모양의 띠지로 들어간다.
 * v3.6: 띠지는 문장 앞 인라인, 문장은 전체 폭으로 흐른다 (라벨 열 고정폭 없음).
 * v3.7: 띠지는 첫 줄에 혼자, 문장은 둘째 줄부터 왼쪽 끝에서 (라벨 위 · 문장 아래). 줄 사이 14px.
 */
/** 행복도 평균(1~10) → 운세와 같은 10점 척도. happinessToScore와 같은 식 ((h−1)/9×10). 평균 10 = 10.0, 1 = 0.0 */
export function happinessMeanToTen(mean: number): number {
  return Math.round(((mean - 1) / 9) * 100) / 10;
}

/** 운세 점수와 내 기록 평균의 차이 판정 (v3.10). 기준 = 밴드 폭 2.0(주의<4.8≤무난<6.8≤좋음):
    2.0 이상 "차이 커요"(밴드가 하나 넘어감), 1.0 이상 "조금 달라요", 그 아래 "비슷해요" */
export function compareVerdict(gap: number): "차이 커요" | "조금 달라요" | "비슷해요" {
  const a = Math.abs(gap);
  return a >= 2 ? "차이 커요" : a >= 1 ? "조금 달라요" : "비슷해요";
}

/** 2026-11-15 (앱 주인 "추천대로" 8번): 기록이 이보다 적으면 막대로 견주지 않는다 — 기록 하나로 그린 막대가 검증된 비교처럼 보였다(GPT 피드백 A2-9). 쓰기 상태값 통계와 같은 기준 */
export const COMPARE_MIN = 5;

/** hasRecall: 인장안에서 지난 기록(같은 날·이런 날)을 함께 그릴 때 — 오늘 글자가 든 기록만 없을 뿐 기록 자체는 있으니 "기록이 없어"라고 말하지 않는다 (디자이너 보고 41-3)
    numbers: 막대 옆 점수 숫자(와 aria-label의 점수). 명세 45(앱 주인 "숫자를 빼 줘"): 인장안은 false — 막대 두 줄 · 판정 말 · 기준 줄만 남는다. story · score는 그대로 */
function PersonalCompare({ personal, fortune, hasRecall = false, numbers = true }: { personal: ReturnType<typeof personalLines>; fortune: FortuneContent; hasRecall?: boolean; numbers?: boolean }) {
  const mean = personal.mean;
  if (mean === null || personal.count < COMPARE_MIN) {
    return (
      <div className="compare mt-3.5">
        <p className="compare__empty">{mean === null ? (hasRecall ? "오늘 글자가 든 날의 기록은 아직 없어요" : personal.main) : `아직 기록이 ${personal.count}번뿐이라 운세와 견주기엔 적어요`}</p>
        {fortune.fitNote && <p className="compare__note">{fortune.fitNote}</p>}
      </div>
    );
  }
  const mine = happinessMeanToTen(mean);
  const verdict = compareVerdict(mine - fortune.score);
  const rows: { label: string; value: number; kind: "fortune" | "mine" }[] = [
    { label: "운세", value: fortune.score, kind: "fortune" },
    { label: "내 기록", value: mine, kind: "mine" },
  ];
  return (
    <div
      className={numbers ? "compare mt-3.5" : "compare compare--bare mt-3.5"}
      aria-label={numbers ? `운세 ${fortune.score.toFixed(1)}점, 내 기록 ${mine.toFixed(1)}점, ${verdict}` : `운세와 내 기록 비교: ${verdict}`}
    >
      {/* v3.10: 제목 없음. 막대 → 띠지 → 작은 한 줄(몇 번 기록 기준인지) */}
      <ul className="compare__bars">
        {rows.map((r) => (
          <li key={r.kind} className="compare__row" data-kind={r.kind}>
            <span className="compare__label">{r.label}</span>
            <span className="compare__track">
              <span className="compare__fill" style={{ width: `${Math.max(4, Math.min(100, r.value * 10))}%` }} />
            </span>
            {numbers && <span className="compare__value">{r.value.toFixed(1)}</span>}
          </li>
        ))}
      </ul>
      <p className="compare__verdict" data-verdict={verdict}>
        {verdict}
      </p>
      <p className="compare__sub">{personal.main}</p>
      {fortune.fitNote && <p className="compare__note">{fortune.fitNote}</p>}
    </div>
  );
}

/** "2026-10-05" → "10월 5일" (지난 기록 줄 — 명세 41) */
const monthDay = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

/**
 * 인장안(명세 41) "내 기록으로 본 오늘" 아래 지난 기록 두 칸 줄 — 같은 날 | 그날의 행복도·기분·있었던 일, 이런 날 | 경향 한 줄.
 * 가운뎃점 대신(톤 v3.13) 날짜는 위 한 줄, 행복도 · 기분 · 있었던 일은 16px 간격으로 띄운 무리 셋(무리 안 여럿은 쉼표). 빈 무리는 빠진다
 */
function RecallRows({ recall }: { recall: FortuneRecall }) {
  return (
    <div className="fc-recall">
      {recall.same.length > 0 && (
        <div className="fc-row">
          <span className="fc-label fc-row__label">같은 날</span>
          <ul className="fc-row__text fc-recall__list">
            {recall.same.map((d) => (
              <li key={d.date}>
                <span className="fc-recall__date">
                  {monthDay(d.date)} {d.ganjiKo}일
                </span>
                <span className="fc-words">
                  <span>행복도 {d.happiness}</span>
                  {d.moods.length > 0 && <span>{d.moods.join(", ")}</span>}
                  {d.states.length > 0 && <span>{d.states.join(", ")}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recall.tendency.length > 0 && (
        <div className="fc-row">
          <span className="fc-label fc-row__label">이런 날</span>
          <ul className="fc-row__text fc-recall__list">
            {recall.tendency.map((t) => (
              <li key={t.family} className="break-keep">
                {joinDots(t.familyWord)}이 온 날 {t.n}번 중 {t.count}번 ‘{t.axisLabel} {t.word}’
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * 인장안(variant "seal") "내 기록으로 본 오늘" — 명세 49 (톤 v3.53, 앱 주인 "가시성이 안 좋아 … 오늘 해 볼 것 위에 올릴까?").
 * 2026-11-20 후속(앱 주인, 배포된 화면을 보고 "너무 어렵게 표현하면 안 돼. 그냥 이런 특징이 있었다라는 것만 남기는 것이 나을 것 같아"):
 *   **운세와 견주는 것은 전부 없다** — 판정 문장 · 별표 각주 · 막대 · "견주기엔 적어요" 줄 · fitNote. 남는 것은 지난 기록의 사실 두 가지뿐:
 *   "지난 같은 날"(그날 행복도 도장 — 달력 칸과 같은 네 단계 색, 날짜, 기분 · 있었던 일 띠) · "비슷한 날엔"("3번 중 2번 ‘돈 많이 나감’이었어요" — 갈래 이름은 쓰지 않는다).
 * 지난 기록(recall)이 있을 때만 펼친 안 맨 위에 온다. 없으면 인장안에는 이 블록이 아예 없다(말할 사실이 없으면 아무것도 없다). story · score는 PersonalCompare 그대로.
 * 블록은 왼쪽 굵은 괘선 한 줄로 묶인다(globals.css .fc-mine*)
 */
function MineBlock({ recall }: { recall: FortuneRecall }) {
  return (
    <section className="fc-section fc-mine" aria-labelledby="compare-title">
      <h3 id="compare-title" className="fc-label">
        내 기록으로 본 오늘
      </h3>
      {(
        <div className="fc-mine__recall">
          {recall.same.length > 0 && (
            <div className="fc-row">
              <span className="fc-label fc-row__label fc-mine__name">지난 같은 날</span>
              <ul className="fc-row__text fc-mine__days">
                {recall.same.map((d) => (
                  <li key={d.date}>
                    <span className="fc-mine__day">
                      <span className="fc-mine__stamp" data-tier={happinessTier(d.happiness)} role="img" aria-label={`행복도 ${d.happiness}`}>
                        {d.happiness}
                      </span>
                      <span className="fc-mine__date">{monthDay(d.date)}</span>
                    </span>
                    {(d.moods.length > 0 || d.states.length > 0) && (
                      <span className="fc-mine__tags">
                        {[...d.moods, ...d.states].map((w) => (
                          <span key={w} className="fc-mine__tag">
                            {w}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recall.tendency.length > 0 && (
            <div className="fc-row">
              <span className="fc-label fc-row__label fc-mine__name">비슷한 날엔</span>
              <ul className="fc-row__text fc-recall__list">
                {recall.tendency.map((t) => (
                  <li key={t.family} className="break-keep">
                    {/* 닫는 따옴표와 어미 사이에 낱말 이음표(U+2060) — 좁은 폭에서 "이었어요"만 다음 줄로 떨어지지 않게 */}
                    {t.n}번 중 {t.count}번 ‘{t.axisLabel} {t.word}’{"⁠"}
                    {batchim(t.word) ? "이었어요" : "였어요"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function FortuneCard({ fortune, ganjiKo, canVote, vote, defaultOpen, version, variant = "story", recall, theme }: Props) {
  /** 카드 시험 1안: 인장 (기능 쪽이 fortune.seals에 넣은 것만. 없으면 줄째 없음) */
  const seals = variant === "seal" ? fortune.seals ?? [] : [];
  /** 카드 시험 2안: 6개 영역 10점 숫자 (오늘 7영역 원자료가 있는 운세만) */
  const areaScores = variant === "score" ? areaScoreView(fortune) : null;
  /** 운세 개편 Phase 2 (명세 35): "오늘 흐름 N / 10" — 반올림을 단계 범위 안으로 맞춘 정수(주의 ≤ 4 · 무난 5~6 · 좋음 ≥ 7). "예상 행복도"라고 부르지 않는다 */
  const flow = flowNumber(fortune.score, fortune.band);
  /** 6영역 도장(오늘 7영역 원자료가 있는 새 운세만). 없으면(옛 캐시) 예전 영역 줄·칩 */
  const six = sixAreaView(fortune);
  /** 2026-11-04 (명세 36): "엇갈리는 날"·"흔들리기 쉬운 날" — 숫자 하나로 뭉개지던 날을 카드 머리 한 줄로. 문구는 코드가 정한 값 그대로, 옛 캐시는 null */
  const shape = dayShapeView(fortune);
  const paragraphs = splitParagraphs(fortune.body);
  /** 영역 줄 최대 4 (오늘 ≤2 · 이달 1 · 올해 1). period는 기능 쪽이 곧 넣는다 — 없으면 "오늘" */
  const areas = (fortune.areas ?? []).slice(0, 4).map((a) => ({ ...a, period: (a as { period?: Period }).period ?? "오늘" }));
  /** v3.37: line이 있으면 줄(↑ → ↓ 순), 비어 있으면 칩(데이터 순서 그대로 — 이달 → 올해) */
  const areaRows = [...areas.filter((a) => a.line && a.signal === "↑"), ...areas.filter((a) => a.line && a.signal === "→"), ...areas.filter((a) => a.line && a.signal === "↓")];
  const areaChips = areas.filter((a) => !a.line);
  const personal = personalLines(fortune, ganjiKo);
  /** 명세 49(2026-11-20 후속): 인장안에서 "내 기록으로 본 오늘"은 지난 기록의 사실(지난 같은 날 · 비슷한 날엔)이 하나라도 있을 때만, 펼친 안 맨 위에. 없으면 블록이 없다 */
  const mineRecall = variant === "seal" && recall && (recall.same.length > 0 || recall.tendency.length > 0) ? recall : null;
  const gaewoon = fortune.core?.luckEls ? gaewoonOf(fortune.core, fortune.date) : null;
  /** v3.36 "오늘 힘이 되는 것": 코어 키워드 긍정 앞 3개 (v4.19는 fortune.keywords, 옛 캐시는 core.keywords). 없으면 줄째 없음 */
  const power = variant === "seal" ? [] : (fortune.keywords?.positive ?? fortune.core?.keywords?.positive ?? []).slice(0, 3);   // 인장 카드에서는 인장이 같은 일을 한다 (2026-11-15 "추천대로" 10번)
  /** 카드 시험(명세 38): seal·score는 머리만 봐도 오늘이 읽히게 — 영역 띠지를 빼고, 펼친 안은 "해 볼 것"이 먼저, 긴 본문은 "풀어서 읽기"로 접힌다 */
  const trial = variant !== "story";
  /** 인장안 정돈 (명세 39, v3.43): 배치만 다르다 — 금색 이중 테·붓 자국·리본 띠지·붓선 대신 왼쪽 축 하나, 작은 라벨, 1px 가는 선, 라벨 칸 | 내용 칸.
      내용·계산·순서는 trial과 같다. 모양은 디자이너(.fortune-card--seal .fc-*) */
  const neat = variant === "seal";
  /** 등불 톤 시안(명세 42 B): 인장안에서만 */
  const lantern = neat && theme === "lantern";
  /** 도화 톤 · 섞은 톤 시안(명세 43): 인장안에서만. 둘 다 금빛 가는 테 · 매듭과 술 · 일진 한자 워터마크를 쓴다 */
  const dohwa = neat && theme === "dohwa";
  const blend = neat && theme === "blend";
  const mark = dohwa || blend ? dayHanja(ganjiKo) : null;
  /** 2안: 머리의 숫자와 같은 말인 6줄 붓 막대 대신, 신호 있는 영역의 이유 한 줄만 */
  const scoreReasons = areaScores?.filter((a) => a.active && a.reason) ?? null;

  /* 아래 조각들은 내용·로직 그대로. story는 지금 순서로, seal·score는 명세 38의 순서로 놓는다 */
  const bodyText = (
    <div className={`${trial ? "fortune-more__body " : ""}flex flex-col gap-3 text-[16px] leading-[1.7] text-ink/90`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="break-keep">
          {p}
        </p>
      ))}
    </div>
  );
  /* v4.7 (2026-10-12): 오늘의 개운 네 칸(색·음식·시간·활동). 전통 오행 대응표로 앱이 고른다(모델 아님). 모양은 디자이너(.gaewoon*)
     v3.39 (명세 35): 기본 접힘 — 제목 한 줄이 summary, 누르면 네 칸. 내용·계산은 그대로, 펼침 모션 없음 */
  const gaewoonBlock = gaewoon ? (
    <details className="gaewoon" aria-label="오늘 챙기면 좋은 것">
      <summary className="gaewoon__title gaewoon__summary">오늘 챙기면 좋은 것</summary>
      {/* 2026-11-15 (앱 주인 "추천대로" 7번): 왜 이 색·음식인지 근거 한 줄 — 오늘 글자와 내게 필요한 기운으로 고른 오행(gaewoon.ts). 모양은 디자이너(.gaewoon__why) */}
      <p className="gaewoon__why break-keep">{gaewoon.reason}</p>
      <ul className="gaewoon__grid">
        <li className="gaewoon__item" data-kind="color">
          <span className="gaewoon__label">행운 색</span>
          <span className="gaewoon__value">
            <span aria-hidden className="gaewoon__swatch" style={{ backgroundColor: gaewoon.color.hex }} />
            {gaewoon.color.name}
          </span>
        </li>
        <li className="gaewoon__item" data-kind="food">
          <span className="gaewoon__label">추천 음식</span>
          <span className="gaewoon__value break-keep">{gaewoon.food}</span>
        </li>
        <li className="gaewoon__item" data-kind="time">
          <span className="gaewoon__label">힘이 나는 시간</span>
          <span className="gaewoon__value break-keep">{gaewoon.time}</span>
        </li>
        <li className="gaewoon__item" data-kind="activity">
          <span className="gaewoon__label">추천 활동</span>
          <span className="gaewoon__value break-keep">{gaewoon.activity}</span>
        </li>
      </ul>
    </details>
  ) : (
    fortune.core?.dayLuck.method === "용신 없음" && (
      <p className="gaewoon__empty">
        태어난 시간을 넣으면 오늘 챙기면 좋은 것이 보여요.{" "}
        <Link href="/onboarding?next=/" className="underline underline-offset-4">
          시간 넣기
        </Link>
      </p>
    )
  );
  /* v3.14 (2026-10-10): "오늘의 특징"(영역 줄, ↑ → ↓ 순). 예전엔 좋은 쪽·조심 쪽 상자에 영역 줄과 행동이 섞여 뒤죽박죽이었다. 모양은 디자이너(.traits*) */
  const traits = (neat || areas.length > 0 || power.length > 0 || six) && (
    <section className={neat ? "fc-section" : "traits mt-6"} aria-labelledby="traits-title">
      <h3 id="traits-title" className={neat ? "fc-label" : "traits__title"}>오늘의 특징</h3>
      {/* 인장안(명세 41): 점수를 카드에서 뺐다 — "흐름 N / 10" 줄과 "엇갈리는 날" 줄(빠진 단계 말을 다시 꺼낸다)은 없다.
          "흔들리기 쉬운 날"(운과 부딪히는 날 — 단계와 무관)만 있는 날에 라벨 칸 | 내용 칸 한 줄. 문구는 코드가 정한 값 그대로 */}
      {neat && shape?.shaky && (
        <div className="fc-facts">
          <div className="fc-row">
            <span className="fc-label fc-row__label" data-kind="shaky">
              {/* 라벨 칸 80px에서 "날"만 떨어지지 않게 "쉬운 날"을 붙인다(보이는 글자는 같다) */}
              흔들리기 쉬운{" "}날
            </span>
            <p className="fc-row__text break-keep">{joinDots(shape.shakyLine ?? shape.line)}</p>
          </div>
        </div>
      )}
      {/* 인장안 정돈(명세 39): 띠지 칩 대신 라벨 칸 | 낱말 한 줄(낱말 사이는 간격 — 가운뎃점 금지 v3.13). 낱말·순서는 그대로 */}
      {power.length > 0 && neat && (
        <div className="fc-row fc-power">
          <p className="fc-label fc-row__label">오늘 힘이 되는 것</p>
          <ul className="fc-row__text fc-words" aria-label="오늘 힘이 되는 것">
            {power.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {/* v3.36: 화살표 줄 위에 "오늘 힘이 되는 것" 띠지 칩 한 줄(긍정 tone = 금빛 선, 면은 한지). 모양은 디자이너(.power*) */}
      {power.length > 0 && !neat && (
        <div className="power">
          <p className="power__title">오늘 힘이 되는 것</p>
          <ul className="power__chips" aria-label="오늘 힘이 되는 것">
            {power.map((w) => (
              <li key={w} className="power-chip">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* 운세 개편 Phase 2 (명세 35): 새 운세는 6영역 도장(이달·올해 칩 없음), 옛 캐시는 아래 예전 줄·칩.
          카드 시험 2안(명세 38): 머리에 영역 숫자가 있으니 6줄 붓 막대와 범례를 빼고, 신호 있는 영역의 이유 한 줄만 목록으로(.area-scores__reason*) */}
      {/* 인장안(명세 42 A): 가운데에서 갈라지는 붓 막대 대신 왼쪽 0에서 채우는 가로 게이지. 50 자리 눈금 위에 "보통" 한 번 —
          이 라벨이 범례를 맡으니 "조심할 쪽 / 좋은 쪽" 범례(SignalLegend stamps)는 인장안에서 그리지 않는다. story는 그대로 */}
      {six && !scoreReasons && neat && (
        <div className="fc-gauge" style={gaugeVars(six)}>
          <span aria-hidden className="fc-gauge__scale">
            <span className="fc-gauge__mid">보통</span>
          </span>
          <AreaSignalGrid areas={six} />
        </div>
      )}
      {six && !scoreReasons && !neat && (
        <>
          <SignalLegend kind="stamps" />
          <AreaSignalGrid areas={six} />
        </>
      )}
      {scoreReasons && scoreReasons.length > 0 && (
        <ul className="area-scores__reasons" aria-label="오늘 움직이는 영역">
          {scoreReasons.map((a) => (
            <li key={a.key} className="area-scores__reason" data-dir={a.strength > 0 ? "up" : "down"}>
              <span className="area-scores__reason-label">{a.label}</span>
              <span className="area-scores__reason-text break-keep">{a.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {/* 화살표 범례: 처음 한 번만 (닫으면 다시 안 뜸) */}
      {!six && areas.length > 0 && <SignalLegend />}
      {/* v3.37 (명세 33, 운세 v4.20): line이 있는 줄(오늘 = 코드가 정한 짧은 상태말, 옛 캐시 = 예전 문장)은 띠지 + 말 한 줄,
          line이 빈 줄(이달·올해)은 문장 없이 화살표 띠지 칩만 한 줄. 행동은 "오늘 해 볼 것"이 맡는다. → 줄은 더 오지 않는다 */}
      {!six && areaRows.length > 0 && (
        <ul className="traits__list">
          {areaRows.map((a) => (
            <li key={`${a.period}-${a.area}`} className="trait break-keep" data-signal={a.signal}>
              <span className="trait__tag sig sig--line">
                <span className="trait__period">{a.period}</span>
                <span className="trait__area">{AREA_WORD[a.area]}</span>
                <span aria-hidden className={`trait__arrow ${SIGNAL_COLOR[a.signal]}`}>
                  {a.signal}
                </span>
                <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
              </span>
              <span className="trait__text">{a.line}</span>
            </li>
          ))}
        </ul>
      )}
      {!six && areaChips.length > 0 && (
        <ul className="traits__chips" aria-label="이달과 올해">
          {areaChips.map((a) => (
            <li key={`${a.period}-${a.area}`} className="trait-chip" data-signal={a.signal}>
              <span className="trait-chip__period">{a.period}</span>
              <span className="trait-chip__area">{AREA_WORD[a.area]}</span>
              <span aria-hidden className={`trait-chip__arrow ${SIGNAL_COLOR[a.signal]}`}>
                {a.signal}
              </span>
              <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  /* "오늘 해 볼 것"(하면 좋아요 · 피해요). story에서는 개운이 이 섹션 안 맨 아래, seal·score에서는 카드의 첫 섹션이고 개운은 "내 기록으로 본 오늘" 뒤로 나간다. 모양은 디자이너(.actions*) */
  const actions = neat ? (
    /* 인장안 정돈(명세 39): 리본 띠지·왼줄 대신 두 줄 — 왼쪽 칸 작은 라벨(좋은 쪽 금빛 글자 · 피할 쪽 먹), 오른쪽 칸 문장. 두 문장의 시작선이 같다 */
    <section className="fc-section" aria-labelledby="actions-title">
      <h3 id="actions-title" className="fc-label">오늘 해 볼 것</h3>
      <div className="fc-row break-keep" data-tone="good">
        <span className="fc-label fc-row__label">하면 좋아요</span>
        <p className="fc-row__text">{fortune.do}</p>
      </div>
      <div className="fc-row break-keep" data-tone="care">
        <span className="fc-label fc-row__label">피해요</span>
        <p className="fc-row__text">{fortune.dont}</p>
      </div>
    </section>
  ) : (
    <section className={trial ? "actions" : "actions mt-6"} aria-labelledby="actions-title">
      <h3 id="actions-title" className="actions__title">오늘 해 볼 것</h3>
      <div className="action action--do break-keep">
        <span className="sig sig--gold">하면 좋아요</span>
        <p className="action__text">{fortune.do}</p>
      </div>
      <div className="action action--dont break-keep">
        <span className="sig sig--ink">피해요</span>
        <p className="action__text">{fortune.dont}</p>
      </div>
      {!trial && gaewoonBlock}
    </section>
  );
  return (
    <details open={defaultOpen} className={neat ? `group fortune-card--seal card-paper text-ink${lantern ? " fc--lantern" : ""}${dohwa ? " fc--dohwa" : ""}${blend ? " fc--blend" : ""}` : "group card-gold card-paper text-ink"}>
      <summary className={neat ? "fc-head cursor-pointer list-none [&::-webkit-details-marker]:hidden" : "cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden"}>
        {/* 등불 톤 시안(명세 42 B): 카드 맨 위 남색 문양 띠(창살 격자 · 구름 고리, 아랫단 주홍 테) + 띠 가운데에서 내려오는 남색 줄과 작은 주홍 술.
            둘 다 장식이라 보조 기술에 읽히지 않고, 술은 자리를 차지하지 않는다(절대 위치). 등불 몸통·꽃 그림은 그리지 않는다 */}
        {lantern && (
          <>
            <span aria-hidden className="fc-lantern__band" />
            <span aria-hidden className="fc-lantern__tassel" />
          </>
        )}
        {/* 도화 · 섞은 톤 시안(명세 43): 카드 테(도화 = 금빛 겹선 사이 뇌문 띠, 섞은 것 = 금빛 겹선) · 섞은 것만 맨 위 남색 뇌문 띠 ·
            가운데 세로축(줄 → 금빛 매듭 → 술) · 머리 양 귀퉁이에 그날 일진 한자 두 글자(아주 흐리게). 전부 장식이라 보조 기술에 읽히지 않고,
            띠를 뺀 나머지는 절대 위치라 내용 칸을 밀지 않는다. 꽃 · 나비 · 복숭아 그림은 그리지 않는다 */}
        {(dohwa || blend) && (
          <>
            {blend && <span aria-hidden className="fc-blend__band" />}
            <span aria-hidden className="fc-frame" />
            {mark && (
              <span aria-hidden className="fc-mark">
                <span>{mark[0]}</span>
                <span>{mark[1]}</span>
              </span>
            )}
            <span aria-hidden className="fc-knot" />
          </>
        )}
        {neat ? (
          /* 인장안(명세 41): 라벨 줄 하나 — 왼쪽 "오늘의 운세", 오른쪽 끝 꺾쇠(닫힘 ⌄ → 열림 ⌃)만. 단계 말·흐름 숫자는 카드에서 뺐다
             (점수는 안에서 기록 비교에만 쓴다) */
          <span className="fc-top">
            <span className="fc-label">오늘의 운세</span>
            <span aria-hidden className="fc-toggle transition-transform group-open:rotate-180" />
          </span>
        ) : (
          <>
            {/* 머리 (v3.7): 날짜·간지는 제목에 있으니 "오늘의 운세"만. 오른쪽은 +/× */}
            <span className="flex items-start justify-between gap-3">
              <span className="text-[15px] text-muted">오늘의 운세</span>
              <span aria-hidden className="text-2xl leading-none text-gold-ink transition-transform group-open:rotate-45">
                +
              </span>
            </span>
            {/* v3.36 (명세 32): 카드의 주인공은 핵심 문장. 밴드 단어는 작은 단계 붓 자국(data-band, v3.11 색 그대로) 위에 송명 22px,
                점수는 그 옆 한 줄 15px muted — 점수는 판정 단계를 계수로 옮긴 값이라 크게 보이면 실제보다 정밀해 보인다. 숨기지는 않는다 */}
            <span className="score-brush mt-2" data-band={fortune.band}>
              <span className="score-brush__band font-serif text-[22px] text-ink">{fortune.band}</span>
              <span className="score-brush__score text-[15px] tabular-nums text-muted">오늘 흐름 {flow} / 10</span>
            </span>
          </>
        )}
        <span className="fortune-headline">{neat ? joinDots(fortune.headline) : fortune.headline}</span>
        {/* 인장안 정돈(명세 39): 핵심 문장과 인장 줄 사이 가는 선 하나. 인장이 없는 옛 운세는 선과 인장 줄이 함께 빠진다 */}
        {neat && seals.length > 0 && <span aria-hidden className="fc-line" />}
        {/* 인장안(명세 41): 인장 1~4개를 두 줄로 — 라벨 칸 "유리한 점" | 좋은 쪽 인장들, "조심할 점" | 조심할 쪽 인장들. 한쪽이 없는 날은 그 줄이 없다.
            명세 46: 라벨 이름을 "힘이 되는 것 / 조심할 것"에서 바꿨다(인장안 전부). 색은 톤마다 — 기본 금빛 · 남색, 섞은 톤 옥색 · 주홍.
            줄 라벨이 뜻을 말하니 인장마다 붙던 보조 기술용 꼬리말은 뺐다. 누르는 것이 아니다. 모양은 디자이너(.fc-seal-rows · .fortune-seal*) */}
        {seals.length > 0 && (
          <span className="fc-seal-rows">
            {(["good", "care"] as const).map((tone) => {
              const group = seals.filter((s) => s.tone === tone);
              return (
                group.length > 0 && (
                  <span key={tone} className="fc-row fc-seal-row" data-tone={tone}>
                    <span className="fc-label fc-row__label">{tone === "good" ? "유리한 점" : "조심할 점"}</span>
                    <span className="fortune-seals">
                      {group.map((s) => (
                        <span key={s.word} className="fortune-seal" data-tone={s.tone}>
                          {s.word}
                        </span>
                      ))}
                    </span>
                  </span>
                )
              );
            })}
          </span>
        )}
        {/* 카드 시험 2안 (명세 38): 핵심 문장 아래 영역 여섯 칸 숫자. 신호 없는 영역(data-active=false)은 5로 흐리게. 모양은 디자이너(.area-scores*) */}
        {areaScores && (
          <span className="area-scores" aria-label="오늘의 영역 점수">
            {areaScores.map((a) => (
              <span key={a.key} className="area-score" data-active={a.active} data-dir={!a.active ? "none" : a.strength > 0 ? "up" : "down"}>
                <span className="area-score__label">{a.label}</span>
                <span className="area-score__num">{a.score}</span>
                <span className="sr-only">{!a.active ? " — 특별한 신호 없음" : a.strength > 0 ? " — 좋은 쪽" : " — 조심할 쪽"}</span>
              </span>
            ))}
          </span>
        )}
        {/* 흐린 5가 "보통 점수"로 읽히지 않게 한 줄 주석 — 신호 없는 영역이 있는 날만 */}
        {areaScores?.some((a) => !a.active) && <span className="area-scores__note">5 = 특별한 신호 없음</span>}
        {/* v3.18 (2026-10-11 Q2 = A): 핵심 문장 아래 오늘 영역 한 줄 — "사람 ↑ · 돈 ↓"를 작은 띠지로. 카드를 펼치기 전에도 보인다.
            엔진은 영역마다 점수가 아니라 방향(↑ → ↓)만 내므로 숫자·막대는 만들지 않는다. 보기만(누르면 카드가 펼쳐질 뿐). 모양은 디자이너(.area-chips*) */}
        {/* 카드 시험(명세 38): 두 안에서는 머리가 붐비지 않게 이 띠지를 그리지 않는다 — 인장·영역 점수가 그 자리를 맡는다 */}
        {!trial && areas.some((a) => a.period === "오늘") && (
          <span className="area-chips" aria-label="오늘 영역">
            {areas
              .filter((a) => a.period === "오늘")
              .map((a) => (
                <span key={a.area} className="area-chip" data-signal={a.signal}>
                  {AREA_WORD[a.area]}
                  <span aria-hidden className={`area-chip__arrow ${SIGNAL_COLOR[a.signal]}`}>
                    {a.signal}
                  </span>
                  <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
                </span>
              ))}
          </span>
        )}
        {/* v3.40 (명세 36): 오늘 영역 띠지 아래 조용한 주석 — 표시(면 없는 녹갈 선 띠지) + 어긋남을 풀어 주는 한 줄.
            제목이 계속 주인공이라 글자는 13/15px, 먹·muted만. 누르는 것이 아니고(summary가 카드를 열 뿐) 아이콘·빨강·금색 글자 없음. 모양은 디자이너(.day-shape*) */}
        {/* 인장안(명세 40): 닫힌 머리에는 주석을 두지 않는다 — 좋은 쪽과 조심할 쪽이 섞인 날은 인장 둘이 말한다. 문구는 펼친 "오늘의 특징" 맨 위로 */}
        {shape && !neat && (
          <span className="day-shape">
            <span className="day-shape__tags">
              {shape.crossed && (
                <span className="day-shape__tag" data-kind="crossed">
                  엇갈리는 날
                </span>
              )}
              {shape.shaky && (
                <span className="day-shape__tag" data-kind="shaky">
                  흔들리기 쉬운 날
                </span>
              )}
            </span>
            <span className="day-shape__line break-keep">{shape.line}</span>
          </span>
        )}
      </summary>

      <div className="fortune-body">
        <div>
          {/* 이용 통계: 카드가 보인 순간(펼쳐짐) fortune_view 한 번 */}
          <FortuneViewTrack band={fortune.band} />
          <div className={neat ? "fc-body" : "px-5 pb-5"}>
            {trial ? (
              <>
                {/* 카드 시험(명세 38): 오늘 해 볼 것 → 오늘의 특징 → 풀어서 읽기(긴 본문, 기본 접힘) → 내 기록으로 본 오늘 → 오늘 챙기면 좋은 것.
                    내용·로직은 story와 같고 순서와 접힘만 다르다. "풀어서 읽기"는 15px muted 한 줄 + 꺾쇠 — 금색 버튼이 아니다(.fortune-more*)
                    명세 49(인장안만): 내 기록으로 본 오늘(말할 것이 있을 때) → 오늘 해 볼 것 → 오늘의 특징 → 풀어서 읽기(처음부터 펼쳐 둠) → 오늘 챙기면 좋은 것 */}
                {mineRecall && <MineBlock recall={mineRecall} />}
                {actions}
                {/* 인장안(명세 39)은 붓선 없이 구역마다 가는 선 + 작은 라벨(.fc-body의 자식마다 위 1px 선) */}
                {traits && !neat && <span aria-hidden className="rule rule--light mt-6" />}
                {traits}
                {paragraphs.length > 0 && (
                  <details className="fortune-more" open={neat || undefined}>
                    <summary className="fortune-more__summary">풀어서 읽기</summary>
                    {bodyText}
                  </details>
                )}
                {/* 인장안(명세 49, 2026-11-20 후속): 여기(풀어서 읽기 아래)에는 아무것도 그리지 않는다 — 지난 기록의 사실이 있으면 맨 위 MineBlock이 말하고,
                    없으면 말할 것이 없다(운세와 견주는 줄 · "아직 기록이 없어…" 한 줄도 없다). 2안(score)은 PersonalCompare 그대로 */}
                {!neat && <PersonalCompare personal={personal} fortune={fortune} />}
                {gaewoonBlock}
              </>
            ) : (
              <>
                {/* v3.36: 헤드라인은 닫힌 카드 머리에 있으니 본문에서 다시 쓰지 않는다. 문단부터 시작 */}
                {/* 본문 2~3문단 (v3.7). 문단 사이 12px, 들여쓰기 없음 */}
                {bodyText}

                {/* 내 기록으로 본 오늘 (v3.2 → v3.9 그림으로): 운세 점수 vs 내 기록 평균(10점 환산) 두 막대 + 차이 판정.
                    기록이 없으면 "아직 기록이 없어 사주만으로" 한 줄. 모양은 디자이너(.compare-*) */}
                <PersonalCompare personal={personal} fortune={fortune} />

                {/* v3.14 (2026-10-10): 섹션 둘로 — "오늘의 특징"(영역 줄, ↑ → ↓ 순) / 붓선 / "오늘 해 볼 것"(하면 좋아요 · 피해요) */}
                {traits}
                <span aria-hidden className="rule rule--light mt-6" />
                {actions}
              </>
            )}

            {neat ? (
              /* 인장안 정돈(명세 39): 붓선 대신 가는 선 한 줄 아래 투표·버전. 투표 동작은 그대로(VoteButtons) */
              (canVote || version) && (
                <div className="fc-section fc-foot">
                  {canVote && <VoteButtons date={fortune.date} initial={vote} />}
                  {version && <p className="fortune-version fc-version">운세 계산 {version}</p>}
                </div>
              )
            ) : (
              <>
                {/* 붓선 — 행동 섹션과 투표 사이 */}
                <span aria-hidden className="rule rule--light mt-6" />

                {/* v3.14: 누르는 즉시 바뀌고 카드가 접히지 않는다 (클라이언트 컴포넌트) */}
                {canVote && <VoteButtons date={fortune.date} initial={vote} />}
                {version && <p className="fortune-version mt-3 text-right text-[12px] text-muted">운세 계산 {version}</p>}
              </>
            )}

          </div>
        </div>
      </div>
    </details>
  );
}
