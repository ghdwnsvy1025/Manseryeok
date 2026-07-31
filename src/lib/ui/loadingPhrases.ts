/**
 * 운세·질문·명언 로딩 중 감성 문구 — 매 마운트마다 섞고, 명언 DB로 보강 가능.
 */

export type LoadingPhrase = {
  kind: "healing" | "philosophy" | "quote";
  line: string;
};

export const FALLBACK_LOADING_PHRASES: LoadingPhrase[] = [
  { kind: "healing", line: "서두르지 않아도 돼요. 오늘도 당신 페이스면 충분해요." },
  { kind: "philosophy", line: "물이 돌을 뚫는 건 힘이 아니라, 멈추지 않는 부드러움이에요." },
  { kind: "quote", line: "작은 불빛 하나만 있어도, 밤은 완전히 어둡지 않아요." },
  { kind: "healing", line: "숨을 한 번 더 들이쉬어 보세요. 그걸로도 이미 잘하고 있어요." },
  { kind: "philosophy", line: "길은 앞에 있는 게 아니라, 걷는 발밑에서 생겨요." },
  { kind: "quote", line: "별은 낮에도 하늘에 있어요. 다만 보이지 않을 뿐이죠." },
  { kind: "healing", line: "완벽하지 않은 하루도, 당신을 어디로든 데려다줘요." },
  { kind: "philosophy", line: "마음이 흔들릴 때야말로, 진짜 방향을 고르는 순간이에요." },
  { kind: "quote", line: "조용한 용기는, 소리 없이 내일을 열어줍니다." },
  { kind: "healing", line: "오늘은 스스로를 다그치지 않아도 되는 날이에요." },
  { kind: "philosophy", line: "천천히 가도, 방향을 잃지 않으면 도착해요." },
  { kind: "quote", line: "비 온 뒤에야 흙냄새가 진해지듯, 하루도 지나야 의미가 남아요." },
  { kind: "healing", line: "괜찮아요. 잠시 멈춰 쉬는 것도 하루의 일부예요." },
  { kind: "philosophy", line: "작은 기록이 쌓이면, 어느새 나를 아는 지도가 돼요." },
  { kind: "quote", line: "밤하늘은 매일 같지만, 바라보는 마음은 매일 달라요." },
  { kind: "healing", line: "오늘의 당신은, 어제의 당신보다 조금 더 자신을 알아가요." },
  { kind: "philosophy", line: "질문은 답을 찾기 위해서가 아니라, 마음을 열기 위해서예요." },
  { kind: "quote", line: "한 줄의 문장도, 하루를 붙잡아 주는 손잡이가 될 수 있어요." },
  { kind: "healing", line: "무리하지 마세요. 오늘 할 수 있는 만큼이면 충분해요." },
  { kind: "philosophy", line: "흘러가는 감정에도 이름이 있으면, 조금 덜 무거워져요." },
  { kind: "quote", line: "바람이 지나간 자리에도, 향기는 조금 남아 있어요." },
  { kind: "healing", line: "스스로를 다정하게 바라보는 일부터 시작해도 좋아요." },
  { kind: "philosophy", line: "운세는 정해진 결말이 아니라, 오늘의 결을 읽는 거울이에요." },
  { kind: "quote", line: "고요한 물결 위에도, 달이 선명하게 떠올라요." },
];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** 마운트마다 새로운 순서의 문구 묶음 */
export function createLoadingPhraseDeck(
  extra: LoadingPhrase[] = []
): LoadingPhrase[] {
  const merged = [...FALLBACK_LOADING_PHRASES, ...extra];
  const seen = new Set<string>();
  const unique: LoadingPhrase[] = [];
  for (const p of merged) {
    const key = p.line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return shuffle(unique);
}

let cachedQuotePhrases: LoadingPhrase[] | null = null;
let fetchPromise: Promise<LoadingPhrase[]> | null = null;

/** 명언 DB에서 짧은 감성 문장 보강 (실패해도 폴백 유지) */
export async function fetchQuoteLoadingPhrases(): Promise<LoadingPhrase[]> {
  if (cachedQuotePhrases) return cachedQuotePhrases;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const res = await fetch("/api/journal/loading-phrases", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { phrases?: LoadingPhrase[] };
      const phrases = Array.isArray(data.phrases) ? data.phrases : [];
      cachedQuotePhrases = phrases.filter(
        (p) => p && typeof p.line === "string" && p.line.trim().length > 0
      );
      return cachedQuotePhrases;
    } catch {
      return [];
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
}
