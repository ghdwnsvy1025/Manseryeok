/** Phase 4 — 개인화 Ridge MVP: 사용자 표시용 안전 문장 */

export function needsMoreRecordsCopy(validCount: number): string {
  const need = Math.max(0, 14 - validCount);
  return `카테고리 유효 기록이 ${validCount}개입니다. 안정적인 개인 패턴을 보려면 약 ${need}개 더 필요합니다. 확정적 운세가 아닙니다.`;
}

export function degradedCopy(): string {
  return "뚜렷한 반복 패턴이 아직 확인되지 않았습니다. 기준선 대비 개선이 없어 예측 숫자는 표시하지 않습니다.";
}

export function earlySignalCopy(): string {
  return "초기 경향만 참고하세요. 표본이 적어 신뢰도가 낮습니다. 개인 기록의 상관관계이며 원인을 단정하지 않습니다.";
}
