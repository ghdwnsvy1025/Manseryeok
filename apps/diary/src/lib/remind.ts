// 저녁 알림 대상 고르기. 순수 함수라 테스트할 수 있다.
// 매시 정각(UTC 10~14시 = 한국 19~23시)에 크론이 부르고, 그 시각이 알림 시각인 사용자 중
// 오늘 아직 기록하지 않은 사람에게만 보낸다.

export interface RemindCandidate {
  user_id: string;
  remind_at: string; // "21:00:00"
  web_push: unknown | null;
  enabled: boolean;
}

export function hourOf(remindAt: string): number {
  const m = /^(\d{1,2})/.exec(remindAt);
  return m ? Number(m[1]) : -1;
}

/** 이 시각에 보낼 사람. 구독 정보가 없거나 꺼져 있거나 오늘 이미 쓴 사람은 뺀다 */
export function pickDue(candidates: RemindCandidate[], kstHour: number, wroteToday: Set<string>): RemindCandidate[] {
  return candidates.filter(
    (c) => c.enabled && c.web_push && hourOf(c.remind_at) === kstHour && !wroteToday.has(c.user_id),
  );
}

export function remindMessage(tomorrowGanjiKo: string): { title: string; body: string; url: string; tag: string } {
  return {
    title: "오늘 한 줄 남길 시간이에요",
    body: `행복도 하나만 골라도 돼요. 내일은 ${tomorrowGanjiKo}일이에요.`,
    url: "/write",
    tag: "night-remind",
  };
}

// Vercel 무료 플랜은 크론을 하루 한 번만 돌릴 수 있어 당분간 밤 9시 하나다. 유료로 바꾸면 [20, 21, 22, 23]으로 늘리고 vercel.json을 매시로.
export const REMIND_HOURS = [21] as const;
export function isAllowedRemindHour(h: number): h is (typeof REMIND_HOURS)[number] {
  return (REMIND_HOURS as readonly number[]).includes(h);
}
