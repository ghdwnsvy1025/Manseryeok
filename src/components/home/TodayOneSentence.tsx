"use client";

import { useEffect, useState } from "react";

type Status =
  | "loading"
  | "no_theory"
  | "insufficient_diary"
  | "ok"
  | "error";

type TheoryEvidence = {
  content: string;
  similarity: number;
  chunkIndex: number;
  title?: string;
  explanation?: string;
};

type Props = {
  ganjiKo: string;
  stemKo: string;
  branchKo: string;
  tenGod: string | null;
  relationLabels: string[];
  sameGanjiCount: number;
  sameGanjiAvgHappiness: number | null;
  sameGanjiAvgCondition: number | null;
  totalEntryDays: number;
  recentWellbeing: number | null;
};

export default function TodayOneSentence(props: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<TheoryEvidence[]>([]);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage("");
    setDetail(null);
    setEvidence([]);
    setShowEvidence(false);
    setShowRaw(false);

    void (async () => {
      try {
        const res = await fetch("/api/home/today-sentence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(props),
        });
        const data = (await res.json()) as {
          status?: Status;
          message?: string;
          detail?: string | null;
          theoryEvidence?: TheoryEvidence[];
        };
        if (cancelled) return;
        const next = data.status ?? "error";
        setStatus(next === "loading" ? "error" : next);
        setMessage(data.message ?? "알 수 없다");
        setDetail(data.detail ?? null);
        setEvidence(Array.isArray(data.theoryEvidence) ? data.theoryEvidence : []);
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("알 수 없다");
        setDetail("요청에 실패했습니다.");
        setEvidence([]);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.ganjiKo,
    props.stemKo,
    props.branchKo,
    props.tenGod,
    props.sameGanjiCount,
    props.sameGanjiAvgHappiness,
    props.sameGanjiAvgCondition,
    props.totalEntryDays,
    props.recentWellbeing,
    props.relationLabels.join("|"),
  ]);

  const tone =
    status === "ok"
      ? { border: "var(--px-accent)", label: "오늘의 한 문장", color: "var(--px-accent)" }
      : status === "insufficient_diary"
        ? { border: "#fbbf24", label: "부족하다", color: "#fbbf24" }
        : { border: "var(--px-border2)", label: "알 수 없다", color: "var(--px-text2)" };

  return (
    <section
      className="border-2 p-3.5 space-y-2"
      style={{
        background: "var(--px-bg2)",
        borderColor: tone.border,
        boxShadow: "3px 3px 0 #000",
      }}
      aria-label="오늘의 한 문장"
      aria-busy={status === "loading"}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black" style={{ color: tone.color }}>
          ■ 오늘의 한 문장
        </p>
        {status !== "loading" && status !== "ok" && (
          <span
            className="text-[10px] font-black px-1.5 py-0.5 border"
            style={{ borderColor: tone.border, color: tone.color }}
          >
            {tone.label}
          </span>
        )}
      </div>

      {status === "loading" ? (
        <p className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
          오늘의 문장을 준비하는 중…
        </p>
      ) : (
        <>
          <p
            className="text-sm font-black leading-relaxed"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {message}
          </p>
          {detail && (
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
              {detail}
            </p>
          )}

          {evidence.length > 0 && (
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={() => setShowEvidence((v) => !v)}
                className="text-[11px] font-bold underline"
                style={{ color: "#60a5fa" }}
                aria-expanded={showEvidence}
              >
                {showEvidence
                  ? "사주 이론 근거 닫기"
                  : `사주 이론 근거 보기 (${evidence.length})`}
              </button>

              {showEvidence && (
                <div
                  className="space-y-2 max-h-80 overflow-y-auto border p-2"
                  style={{
                    borderColor: "var(--px-border)",
                    background: "var(--px-bg3)",
                  }}
                >
                  <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
                    테스트용 · RAG 청크를 쉬운 문장으로 풀어 쓴 근거
                  </p>
                  {evidence.map((item, idx) => (
                    <article
                      key={`${item.chunkIndex}-${idx}`}
                      className="border p-2 space-y-1.5"
                      style={{ borderColor: "var(--px-border2)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className="text-[11px] font-black"
                          style={{ color: "var(--px-accent)" }}
                        >
                          {item.title?.trim() || `근거 ${idx + 1}`}
                        </p>
                        <p
                          className="text-[10px] font-bold tabular-nums shrink-0"
                          style={{ color: "var(--px-text2)" }}
                        >
                          유사도 {(item.similarity * 100).toFixed(1)}%
                        </p>
                      </div>
                      <p
                        className="text-[12px] leading-relaxed"
                        style={{ color: "var(--px-text-on-panel)" }}
                      >
                        {item.explanation?.trim() || item.content}
                      </p>
                    </article>
                  ))}

                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-[10px] font-bold underline"
                    style={{ color: "var(--px-text2)" }}
                    aria-expanded={showRaw}
                  >
                    {showRaw ? "원문 청크 닫기" : "원문 청크 보기"}
                  </button>

                  {showRaw &&
                    evidence.map((item, idx) => (
                      <article
                        key={`raw-${item.chunkIndex}-${idx}`}
                        className="border p-2 space-y-1"
                        style={{ borderColor: "var(--px-border)" }}
                      >
                        <p
                          className="text-[10px] font-black"
                          style={{ color: "var(--px-text2)" }}
                        >
                          원문 {idx + 1}
                        </p>
                        <p
                          className="text-[10px] leading-relaxed whitespace-pre-wrap"
                          style={{ color: "var(--px-text2)" }}
                        >
                          {item.content}
                        </p>
                      </article>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
