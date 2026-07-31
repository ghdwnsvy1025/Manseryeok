"use client";

import { useCallback, useEffect, useState } from "react";
import { BETA_FEEDBACK_CATEGORY_LABELS, type BetaFeedbackCategory } from "@/lib/feedback/betaFeedback";

type FeedbackItem = {
  id: string;
  userId: string;
  category: string;
  message: string;
  path: string;
  createdAt: string;
};

export default function AdminBetaFeedbackPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/beta-feedback?limit=40");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "피드백을 불러오지 못했습니다.");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("피드백 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div
      className="p-4 border-2 space-y-3"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm" style={{ color: "var(--px-accent)" }}>
          베타 피드백
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-xs font-bold underline"
          style={{ color: "#60a5fa" }}
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}

      {items.length === 0 && !error ? (
        <p className="ui-hint">아직 받은 의견이 없습니다.</p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((item) => {
            const label =
              BETA_FEEDBACK_CATEGORY_LABELS[
                item.category as BetaFeedbackCategory
              ] ?? item.category;
            return (
              <li
                key={item.id}
                className="p-3 border-2 space-y-1"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg3)",
                }}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className="text-xs font-black"
                    style={{ color: "var(--px-accent)" }}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
                    {item.path}
                  </span>
                  <span className="text-[10px] font-bold ml-auto" style={{ color: "var(--px-text2)" }}>
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <p
                  className="text-sm font-bold leading-snug"
                  style={{ color: "var(--px-text)" }}
                >
                  {item.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
