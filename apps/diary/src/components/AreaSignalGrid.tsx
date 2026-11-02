"use client";

import { track } from "@/lib/analytics";
import type { SixAreaView } from "@/lib/fortune/areaProfile";

/**
 * 운세 개편 Phase 2 (2026-11-01, 명세 35): 오늘의 영역 6줄 — 기록 화면과 같은 6개 영역.
 * v2 (사용자: "오행 막대처럼 눈에 잘 보이는 세련된 막대로"): 도장 5칸 대신 가운데에서 갈라지는 붓 막대 한 줄.
 *   가운데 = 특별한 신호 없음, 오른쪽(금빛) = 좋은 쪽 신호, 왼쪽(남색) = 조심할 쪽 신호. 길이 --len = 신호 세기 |합| ÷ 3 (0.33 ~ 1).
 *   신호 없는 영역은 막대 없이 가운데 눈금만 — "3점 예상"이 아니라 "특별한 신호 없음".
 * 신호 있는 영역을 누르면 "왜 이 위치인지" 한 줄(고정 문구표, AI 호출 없음)이 그 줄 아래 전체 폭으로 펼쳐진다.
 * 모양은 디자이너(.area-grid*). 이유를 펼치면 fortune_area_reason_open {area, level} 한 번(펼칠 때마다).
 */
export function AreaSignalGrid({ areas }: { areas: readonly SixAreaView[] }) {
  return (
    <ul className="area-grid" aria-label="오늘의 영역">
      {areas.map((a) => {
        const dir = !a.active ? "none" : a.level >= 4 ? "up" : "down";
        // v3 (사용자: "좋고 나쁨이 다 같은 길이 — 정도가 달랐으면"): 길이 = 실제 신호 세기 |합| ÷ 3 (3 이상은 끝까지).
        //   세기 값은 1 · 1.5 · 2 · 2.5 · 3(+) 다섯 계단이 실제로 나온다(5명 × 365일). 예전 두 계단(0.5 / 1)은 신호 2개 이상인 날의 71%가 전부 같은 길이였다.
        //   퍼센트 숫자는 보이지 않는다 — 계단이 다섯뿐이라 "72%" 같은 숫자는 없는 정밀함을 지어낸다
        const len = !a.active ? 0 : Math.min(Math.abs(a.strength), 3) / 3;
        const bar = (
          <span className="area-grid__bar" data-dir={dir} aria-hidden>
            <span className="area-grid__axis" />
            {a.active && <span className="area-grid__fill" style={{ "--len": len } as React.CSSProperties} />}
          </span>
        );
        const strength = len >= 0.99 ? " (뚜렷함)" : len <= 0.34 ? " (약함)" : "";
        const label = `${a.label}: ${a.active ? (dir === "up" ? `좋은 쪽 신호${strength}` : `조심할 쪽 신호${strength}`) : "특별한 신호 없음"}`;
        return (
          <li key={a.key} className="area-grid__item" data-active={a.active ? "" : undefined} data-dir={dir} data-mixed={a.mixed ? "" : undefined}>
            {a.active && a.reason ? (
              <details
                className="area-grid__details"
                onToggle={(e) => {
                  if ((e.currentTarget as HTMLDetailsElement).open) track("fortune_area_reason_open", { area: a.key, level: a.level });
                }}
              >
                <summary className="area-grid__row" aria-label={`${label} — 이유 보기`}>
                  <span className="area-grid__label">{a.label}</span>
                  {bar}
                </summary>
                <p className="area-grid__reason">{a.reason}</p>
              </details>
            ) : (
              <div className="area-grid__row" aria-label={label}>
                <span className="area-grid__label">{a.label}</span>
                {bar}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
