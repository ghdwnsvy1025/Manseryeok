// 오늘 저장한 기록을 운세 카드 "내 기록으로 본 오늘"에 바로 반영한다 (전수조사 B5).
// 운세 캐시는 날짜 단위라 personal이 저장 전 값이다. 점수·밴드·글은 캐시 그대로 두고(글과 어긋나지 않게),
// 내 기록 블록(personal)과 맞춤도(fitPercent)만 현재 기록으로 다시 센다. 순수 함수 — 모델 호출 없음.
import { dayGanji } from "../ganji";
import { adjustWithEntries, fitPercent, type EntryLike } from "./personal";
import type { FortuneContent } from "./types";

/** adjustWithEntries가 쓰는 사주 쪽 0~1 점수. v4는 core.parts.score01, v3는 base.score. 둘 다 없으면 캐시의 personal.score */
function baseScore01(fortune: FortuneContent): number {
  return fortune.core?.parts.score01 ?? fortune.base?.score ?? fortune.personal.score;
}

/**
 * personal·fitPercent를 현재 기록으로 덮어쓴 새 객체. score·band·headline 등은 그대로.
 * 입력 객체는 바꾸지 않는다. 운세 날짜가 today와 다르면(지난 캐시) 손대지 않고 그대로 돌려준다.
 */
export function withLivePersonal(fortune: FortuneContent, entries: EntryLike[], today: string): FortuneContent {
  if (fortune.date !== today) return fortune;
  const t = dayGanji(today);
  const personal = adjustWithEntries(baseScore01(fortune), entries, { index: t.index, stemKo: t.stemKo, branchKo: t.branchKo });
  return { ...fortune, personal, fitPercent: fitPercent(entries.length) };
}
