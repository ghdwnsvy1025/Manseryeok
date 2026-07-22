"use client";

import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "ready"; lines: [string, string, string]; chunkCount: number }
  | { status: "idle"; message: string };

/**
 * 학습된 이론(RAG)이 있으면 성향 3줄 표시.
 * 청크가 없으면 LLM을 쓰지 않고 안내만 보여 준다.
 */
export default function TendencyThreeLines({
  hints,
}: {
  hints?: {
    ganjiKo?: string;
    heavenlyStem?: string;
    earthlyBranch?: string;
    tenGod?: string | null;
    elementHints?: string[];
  };
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch("/api/narrative/tendency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hints: hints ?? {} }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          lines?: [string, string, string];
          chunkCount?: number;
          message?: string;
          usedRag?: boolean;
        };
        if (cancelled) return;
        if (data.ok && data.lines && data.lines.length >= 3) {
          setState({
            status: "ready",
            lines: [data.lines[0], data.lines[1], data.lines[2]],
            chunkCount: data.chunkCount ?? 0,
          });
          return;
        }
        setState({
          status: "idle",
          message:
            data.message ||
            "학습된 이론이 아직 이 화면에 연결되지 않았습니다.",
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "idle",
            message: "성향 요약을 불러오지 못했습니다.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    hints?.ganjiKo,
    hints?.heavenlyStem,
    hints?.earthlyBranch,
    hints?.tenGod,
    hints?.elementHints?.join("|"),
  ]);

  return (
    <section
      className="rounded-lg border p-4 space-y-2"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg2)",
      }}
      aria-label="학습 이론 기반 성향 요약"
    >
      <h3 className="font-bold text-sm" style={{ color: "var(--px-fg)" }}>
        성향 3줄 (학습 이론)
      </h3>
      {state.status === "loading" && (
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          학습된 이론을 찾아보는 중…
        </p>
      )}
      {state.status === "idle" && (
        <p className="text-sm" style={{ color: "var(--px-muted)" }}>
          {state.message}
        </p>
      )}
      {state.status === "ready" && (
        <>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed">
            {state.lines.map((line) => (
              <li key={line} style={{ color: "var(--px-fg)" }}>
                {line}
              </li>
            ))}
          </ol>
          <p className="text-[10px]" style={{ color: "var(--px-muted)" }}>
            등록된 이론 {state.chunkCount}조각을 참고했습니다. 확정 예언이
            아닙니다.
          </p>
        </>
      )}
    </section>
  );
}
