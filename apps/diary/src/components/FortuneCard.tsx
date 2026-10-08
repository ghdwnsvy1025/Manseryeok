import { BRANCHES, BRANCHES_KO, STEMS, STEMS_KO } from "@saju/engine";
import { fortuneVoteAction } from "@/app/actions";
import { SignalLegend } from "@/components/SignalLegend";
import { AREA_WORD } from "@/lib/fortune/core";
import type { AreaSignal, FortuneContent } from "@/lib/fortune/types";

/** 화살표 색: ↑ 금색, → 보조, ↓ 먹색. 빨강 없음 (톤 결정표 "길흉을 색으로 말하지 않는다") */
const SIGNAL_COLOR: Record<AreaSignal, string> = { "↑": "text-gold", "→": "text-muted", "↓": "text-ink" };
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
function personalLines(fortune: FortuneContent, ganjiKo: string): { main: string; compare: string | null; mean: number | null } {
  const p = fortune.personal;
  const stem = ganjiKo.slice(0, 1);
  const branch = ganjiKo.slice(1);
  let main: string;
  let mean: number | null = null;
  if (p.sameGanjiCount > 0 && p.sameGanjiMean !== null) {
    mean = p.sameGanjiMean;
    main = `${ganjiKo}일에 ${p.sameGanjiCount}번 기록 · 평균 ${mean.toFixed(1)}`;
  } else if (p.n > 0 && p.mean !== null) {
    mean = p.mean;
    main = `${stem}${batchim(stem) ? "이나" : "나"} ${branch}${batchim(branch) ? "이" : "가"} 든 날에 ${p.n}번 · 평균 ${mean.toFixed(1)}`;
  } else {
    return { main: "아직 기록이 없어 사주만으로 계산했어요", compare: null, mean: null };
  }
  return { main, compare: null, mean };
}

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

function PersonalCompare({ personal, fortune }: { personal: ReturnType<typeof personalLines>; fortune: FortuneContent }) {
  const mean = personal.mean;
  if (mean === null) {
    return (
      <div className="compare mt-3.5">
        <p className="compare__empty">{personal.main}</p>
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
    <div className="compare mt-3.5" aria-label={`운세 ${fortune.score.toFixed(1)}점, 내 기록 ${mine.toFixed(1)}점, ${verdict}`}>
      {/* v3.10: 제목 없음. 막대 → 띠지 → 작은 한 줄(몇 번 기록 기준인지) */}
      <ul className="compare__bars">
        {rows.map((r) => (
          <li key={r.kind} className="compare__row" data-kind={r.kind}>
            <span className="compare__label">{r.label}</span>
            <span className="compare__track">
              <span className="compare__fill" style={{ width: `${Math.max(4, Math.min(100, r.value * 10))}%` }} />
            </span>
            <span className="compare__value">{r.value.toFixed(1)}</span>
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

export function FortuneCard({ fortune, ganjiKo, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  const paragraphs = splitParagraphs(fortune.body);
  /** 영역 줄 최대 4 (오늘 ≤2 · 이달 1 · 올해 1). period는 기능 쪽이 곧 넣는다 — 없으면 "오늘" */
  const areas = (fortune.areas ?? []).slice(0, 4).map((a) => ({ ...a, period: (a as { period?: Period }).period ?? "오늘" }));
  const personal = personalLines(fortune, ganjiKo);
  return (
    <details open={defaultOpen} className="group card-gold card-paper text-ink">
      <summary className="cursor-pointer list-none p-5 [&::-webkit-details-marker]:hidden">
        {/* 머리 (v3.7): 날짜·간지는 제목에 있으니 "오늘의 운세"만. 오른쪽은 +/× */}
        <span className="flex items-start justify-between gap-3">
          <span className="text-[15px] text-muted">오늘의 운세</span>
          <span aria-hidden className="text-2xl leading-none text-gold transition-transform group-open:rotate-45">
            +
          </span>
        </span>
        {/* 카드의 주인공 — 밴드 단어 + 점수, 카드 폭 가운데, 뒤에 금빛 붓 자국 (v3.7).
            v3.11: 붓 자국 색만 단계별(data-band: 좋음 금빛 · 무난 녹갈 · 주의 옅은 먹빛). 카드 바탕·숫자 색은 같다 */}
        <span className="score-brush mt-2" data-band={fortune.band}>
          <span className="font-serif text-[44px] text-ink">{fortune.band}</span>
          <span className="font-serif text-[34px] tabular-nums text-gold-ink">{scoreText}</span>
          <span className="text-[14px] text-muted">/10</span>
        </span>
      </summary>

      <div className="fortune-body">
        <div>
          <div className="px-5 pb-5">
            <h2 className="border-l-2 border-gold pl-3 font-serif text-[24px] leading-snug">{fortune.headline}</h2>
            {/* 본문 2~3문단 (v3.7). 문단 사이 12px, 들여쓰기 없음 */}
            <div className="mt-3 flex flex-col gap-3 text-[16px] leading-[1.7] text-ink/90">
              {paragraphs.map((p, i) => (
                <p key={i} className="break-keep">
                  {p}
                </p>
              ))}
            </div>

            {/* 내 기록으로 본 오늘 (v3.2 → v3.9 그림으로): 운세 점수 vs 내 기록 평균(10점 환산) 두 막대 + 차이 판정.
                기록이 없으면 "아직 기록이 없어 사주만으로" 한 줄. 모양은 디자이너(.compare-*) */}
            <PersonalCompare personal={personal} fortune={fortune} />

            {/* 오늘의 신호 (v3.4 → v3.7 라벨 위·문장 아래): 한 상자에 같은 띠지. 영역 = 먹색 테두리, 하면 좋아요 = 금색 면, 피해요 = 먹색 면.
                화살표는 글자, 색으로 길흉을 말하지 않는다(↓도 ink) */}
            <SignalLegend />
            <ul className="signal-box mt-5 list-none text-[16px] leading-[1.5]">
              {areas.map((a) => (
                <li key={`${a.period}-${a.area}`} className="signal-box__row break-keep text-ink/90">
                  <span className="sig sig--line">
                    <span className="text-muted">{a.period}</span>
                    <span aria-hidden className="mx-1 text-muted">·</span>
                    <span>{AREA_WORD[a.area]}</span>
                    <span aria-hidden className={`ml-1 ${SIGNAL_COLOR[a.signal]}`}>
                      {a.signal}
                    </span>
                    <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
                  </span>
                  <span className="signal-box__text">{a.line}</span>
                </li>
              ))}
              <li className="signal-box__row break-keep">
                <span className="sig sig--gold">하면 좋아요</span>
                <span className="signal-box__text">{fortune.do}</span>
              </li>
              <li className="signal-box__row break-keep text-ink/85">
                <span className="sig sig--ink">피해요</span>
                <span className="signal-box__text">{fortune.dont}</span>
              </li>
            </ul>

            {/* 카드 안 붓선은 이 한 곳뿐 — 띠지와 맨 아래(투표·근거) 사이 */}
            <span aria-hidden className="rule rule--light mt-5" />

            {canVote && (
              <form action={fortuneVoteAction} className="vote mt-4 flex flex-wrap items-center gap-2 text-sm text-muted" data-voted={vote !== null ? "" : undefined}>
                <input type="hidden" name="date" value={fortune.date} />
                <span className="mr-1">오늘과 맞았어요?</span>
                {/* 눌린 쪽을 다시 누르면 value "0" → 투표 취소 (actions.ts fortuneVoteAction).
                    모양(v3.9): 안 눌림 = 녹갈 테두리 pill 44px, 눌림(aria-pressed) = 금색 면 + 먹색 굵게 + 1.04, 반대쪽 흐림 — globals.css .vote */}
                <button
                  type="submit"
                  name="vote"
                  value={vote === 1 ? "0" : "1"}
                  aria-pressed={vote === 1}
                  className="vote__btn"
                >
                  맞아요
                </button>
                <button
                  type="submit"
                  name="vote"
                  value={vote === -1 ? "0" : "-1"}
                  aria-pressed={vote === -1}
                  className="vote__btn"
                >
                  아니에요
                </button>
                {/* 투표 뒤 한 줄 — 눌린 상태일 때만 */}
                {vote !== null && <span className="basis-full break-keep text-[14px] text-muted">고마워요, 내일 운세에 반영해요 · 다시 누르면 취소돼요</span>}
              </form>
            )}

          </div>
        </div>
      </div>
    </details>
  );
}
