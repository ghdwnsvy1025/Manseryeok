import { fortuneVoteAction } from "@/app/actions";
import { AREA_WORD } from "@/lib/fortune/core";
import type { AreaSignal, FortuneContent } from "@/lib/fortune/types";

/** 화살표 색: ↑ 금색, → 보조, ↓ 먹색. 빨강 없음 (톤 결정표 "길흉을 색으로 말하지 않는다") */
const SIGNAL_COLOR: Record<AreaSignal, string> = { "↑": "text-gold", "→": "text-muted", "↓": "text-ink" };
const SIGNAL_WORD: Record<AreaSignal, string> = { "↑": "좋아요", "→": "보통이에요", "↓": "조심해요" };
type Period = "오늘" | "이달" | "올해";

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
function personalLines(fortune: FortuneContent, ganjiKo: string): { main: string; compare: string | null } {
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
    return { main: "아직 기록이 없어 사주만으로 계산했어요", compare: null };
  }
  const scaled = mean * (10 / 9);
  const gap = scaled - fortune.score;
  const compare =
    Math.abs(gap) >= 1.5 ? `사주 점수는 ${fortune.score.toFixed(1)}이지만 내 기록은 ${gap > 0 ? "좋은" : "낮은"} 편` : null;
  return { main, compare };
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
export function FortuneCard({ fortune, ganjiKo, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  const paragraphs = splitParagraphs(fortune.body);
  /** 영역 줄 최대 4 (오늘 ≤2 · 이달 1 · 올해 1). period는 기능 쪽이 곧 넣는다 — 없으면 "오늘" */
  const areas = (fortune.areas ?? []).slice(0, 4).map((a) => ({ ...a, period: (a as { period?: Period }).period ?? "오늘" }));
  const personal = personalLines(fortune, ganjiKo);
  // 근거: core.facts 뒤에 core.contextFacts(기능 쪽이 넣는 중 — 없으면 빈 배열)를 이어서
  const contextFacts: string[] = (fortune.core as { contextFacts?: string[] } | undefined)?.contextFacts ?? [];
  // 절기일엔 같은 맥락 문장이 facts와 contextFacts 양쪽에 있어 중복을 뺀다
  const facts = Array.from(new Set([...(fortune.core?.facts ?? fortune.base?.facts ?? []), ...contextFacts])).slice(0, 12);
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
            좋음/무난/주의 모두 같은 색·같은 붓바탕 — 색으로 길흉을 말하지 않는다 */}
        <span className="score-brush mt-2">
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

            {/* 내 기록으로 본 오늘 (v3.2): 한지보다 한 단계 어두운 네모. 기록이 없으면 같은 자리에 사주만으로 계산했다는 말 */}
            <div className="mt-5 rounded-[4px] bg-paper-3 px-4 py-3">
              <p className="text-[13px] text-muted">내 기록으로 본 오늘</p>
              <p className="mt-1 text-[16px] leading-[1.6] text-ink">{personal.main}</p>
              {personal.compare && <p className="mt-0.5 text-[15px] leading-[1.6] text-ink/85">{personal.compare}</p>}
              {fortune.fitNote && <p className="mt-1 text-[14px] leading-[1.6] text-muted">{fortune.fitNote}</p>}
            </div>

            {/* 오늘의 신호 (v3.4 → v3.7 라벨 위·문장 아래): 한 상자에 같은 띠지. 영역 = 먹색 테두리, 하면 좋아요 = 금색 면, 피해요 = 먹색 면.
                화살표는 글자, 색으로 길흉을 말하지 않는다(↓도 ink) */}
            <ul className="signal-box mt-5 list-none text-[16px] leading-[1.5]">
              {areas.map((a) => (
                <li key={`${a.period}-${a.area}`} className="signal-box__row break-keep text-ink/90">
                  <span className="sig sig--line">
                    <span className="text-muted">{a.period}</span>
                    <span aria-hidden className="mx-1 text-faint">·</span>
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
              <form action={fortuneVoteAction} className="mt-4 flex items-center gap-2 text-sm text-muted">
                <input type="hidden" name="date" value={fortune.date} />
                <span className="mr-1">오늘과 맞았어요?</span>
                <button
                  type="submit"
                  name="vote"
                  value="1"
                  aria-pressed={vote === 1}
                  className={`h-9 rounded-full border px-4 ${vote === 1 ? "border-gold font-bold text-ink" : "border-frame/50 text-ink"}`}
                >
                  맞아요
                </button>
                <button
                  type="submit"
                  name="vote"
                  value="-1"
                  aria-pressed={vote === -1}
                  className={`h-9 rounded-full border px-4 ${vote === -1 ? "border-gold font-bold text-ink" : "border-frame/50 text-ink"}`}
                >
                  아니에요
                </button>
              </form>
            )}

            {/* 왜 이런 운세인가요? — core.facts 6~10줄, 왼쪽 금색 세로선 (v3.2) */}
            {facts.length > 0 && (
              <details className="group/why mt-4">
                <summary className="cursor-pointer list-none text-[15px] text-muted underline underline-offset-4 [&::-webkit-details-marker]:hidden">
                  왜 이런 운세인가요?
                </summary>
                <ul className="mt-3 flex flex-col gap-1.5 border-l-2 border-gold pl-3 text-[14px] leading-[1.6] text-muted">
                  {facts.map((f, i) => (
                    <li key={i} className="break-keep">
                      {f}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
