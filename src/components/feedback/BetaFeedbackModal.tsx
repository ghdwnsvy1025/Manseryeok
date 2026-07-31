"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BETA_FEEDBACK_CATEGORIES,
  BETA_FEEDBACK_CATEGORY_LABELS,
  BETA_FEEDBACK_MAX_LEN,
  type BetaFeedbackCategory,
} from "@/lib/feedback/betaFeedback";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function BetaFeedbackModal({ open, onClose }: Props) {
  const pathname = usePathname();
  const [category, setCategory] = useState<BetaFeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const resetAndClose = () => {
    setCategory("bug");
    setMessage("");
    setError(null);
    setDone(false);
    setSaving(false);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/beta-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          path: pathname || "/",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "보내지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      captureEvent(ANALYTICS_EVENTS.feedbackSubmitted, {
        category,
        path: pathname || "/",
      });
      setDone(true);
    } catch {
      setError("네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-feedback-title"
    >
      <div
        className="w-full max-w-sm border-2 p-4 space-y-3 motion-modal-card"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "6px 6px 0 #000",
        }}
      >
        {done ? (
          <>
            <p
              id="beta-feedback-title"
              className="text-base font-black"
              style={{ color: "var(--px-accent)" }}
            >
              보내 주셔서 고마워요
            </p>
            <p
              className="text-sm font-bold leading-relaxed"
              style={{ color: "var(--px-text)" }}
            >
              더 다정한 앱으로 반영할게요.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="w-full py-3 text-sm font-black border-2"
              style={{
                borderColor: "#000",
                color: "#111",
                background: "var(--px-accent)",
                boxShadow: "3px 3px 0 #000",
              }}
            >
              닫기
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  id="beta-feedback-title"
                  className="text-base font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  의견 보내기
                </p>
                <p className="text-[11px] font-bold mt-1" style={{ color: "var(--px-text2)" }}>
                  버그·어색한 문장·아이디어를 짧게 적어 주세요. (일기 본문은 넣지
                  않아도 돼요)
                </p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="text-xs font-bold underline shrink-0"
                style={{ color: "var(--px-text2)" }}
              >
                닫기
              </button>
            </div>

            <div className="saju-choice-track" role="radiogroup" aria-label="유형" style={{ maxWidth: "100%", flexWrap: "wrap" }}>
              {BETA_FEEDBACK_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  className={`saju-choice-chip${category === c ? " is-on" : ""}`}
                  style={{ flex: "1 1 40%", borderBottom: "2px solid #000" }}
                  onClick={() => setCategory(c)}
                >
                  {BETA_FEEDBACK_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                내용
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, BETA_FEEDBACK_MAX_LEN))}
                rows={4}
                required
                maxLength={BETA_FEEDBACK_MAX_LEN}
                placeholder="예: 홈에서 운세 문구가 어색해요 / 저장 버튼이 안 눌려요"
                className="px-input px-3 py-2 text-sm w-full resize-none"
              />
              <span className="text-[10px] font-bold text-right" style={{ color: "var(--px-text2)" }}>
                {message.length}/{BETA_FEEDBACK_MAX_LEN}
              </span>
            </label>

            <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
              현재 화면: {pathname || "/"}
            </p>

            {error && (
              <p className="text-xs font-bold" style={{ color: "#f87171" }} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 text-sm font-black border-2"
              style={{
                borderColor: "#000",
                color: "#111",
                background: "var(--px-accent)",
                boxShadow: "3px 3px 0 #000",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "보내는 중..." : "보내기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
