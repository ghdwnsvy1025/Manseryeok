"use client";

/**
 * 운세 맨 위에 붙는 "오늘 이걸 근거로 씁니다" 상자.
 *
 * 왜 코드로 쓰는가 — 실제로 재 봤기 때문이다.
 *
 * 같은 날·같은 사람으로 **정반대 주장**을 넣고 운세를 뽑아 봤다.
 *   A: "집중·실행이 평소보다 1.5 **높았다**"
 *   B: "집중·실행이 평소보다 1.5 **낮았다**"
 *
 * 입력에는 정확히 들어갔다(payload 15% 지점 확인). 그런데 나온 문장은
 * B(낮았다)인데도 "맡은 일에 집중하고"라고 썼다. **방향을 안 따른다.**
 * 원인은 분량이다 — 전체 입력 14,127자 중 analysisFacts 가 11,960자(85%)라
 * 한 줄짜리 지시가 묻힌다.
 *
 * 프롬프트를 소극형("어긋나지 않게")에서 적극형("반드시 드러내라")으로 고치니
 * 직장운은 신호가 잡음을 넘었지만 종합운은 여전히 묻혔다.
 * **그래서 부탁을 그만두고 앱이 직접 쓴다.** 이 앱의 약속이 여기 걸려 있다 —
 * 기록이 운세를 바꿨으면 바꿨다는 사실이 눈에 보여야 한다.
 *
 * 프롬프트 쪽은 그대로 둔다. 모델이 맞춰 주면 이득이고 무시해도 손해는 없다.
 */
import type { HomeCompletion } from "@/lib/hypothesis/homeCompletion";

export default function TodayEvidenceNote({
  fit,
}: {
  fit: HomeCompletion | null;
}) {
  const patterns = fit?.todayPatterns ?? [];
  const yongsin = fit?.todayYongsin?.isYongsinDay ? fit.todayYongsin : null;

  if (patterns.length === 0 && !yongsin) return null;

  return (
    <section
      className="px-card p-3 space-y-3"
      aria-label="오늘 운세의 근거"
      style={{ borderColor: "var(--px-accent)" }}
    >
      {/* 기록으로 확인된 것이 먼저다 — 이론보다 앞선다 */}
      {patterns.length > 0 && (
        <div className="space-y-1.5">
          <p className="ui-hint">내 기록으로 확인된 오늘</p>
          {patterns.slice(0, 2).map((p) => (
            <div key={p.ruleId} className="flex items-baseline gap-2">
              <span
                className="text-sm font-black shrink-0"
                style={{ color: p.up ? "#4ade80" : "#f87171" }}
              >
                {p.up ? "▲" : "▼"}
              </span>
              <span className="min-w-0">
                <span
                  className="text-sm font-bold"
                  style={{ color: p.up ? "#4ade80" : "#f87171" }}
                >
                  {p.fact}
                </span>
                <span className="ui-hint">
                  {" "}
                  · {p.dayTitle} · {p.matchedDays}일 기준
                </span>
                {p.isException && (
                  <span
                    className="ml-1 text-[10px] font-medium"
                    style={{ color: "#60a5fa" }}
                  >
                    사주 예상과 반대
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {yongsin && (
        <div className="space-y-1">
          <p className="ui-hint">오늘 들어온 기운</p>
          <p
            className="text-sm font-black leading-snug"
            style={{ color: "var(--px-accent)" }}
          >
            {yongsin.elementWord} — 당신에게 힘을 보태는 쪽이에요
          </p>
          <p className="ui-hint leading-relaxed">
            {yongsin.fromTZone
              ? "사주 안에 이미 있는 기운이라 오늘은 그 자리가 더 또렷해집니다."
              : "평소 사주에 없던 기운이라, 오늘은 밖에서 채워지는 날입니다."}
          </p>
        </div>
      )}
    </section>
  );
}
