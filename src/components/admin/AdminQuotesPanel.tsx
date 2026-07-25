"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuoteLibraryItem } from "@/lib/journal/quote/types";

export default function AdminQuotesPanel() {
  const [quotes, setQuotes] = useState<QuoteLibraryItem[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [form, setForm] = useState({
    quoteTextKo: "",
    authorName: "",
    workTitle: "",
    sourceUrl: "",
    rightsStatus: "public_domain",
    verificationStatus: "primary_source_verified",
    attributionConfidence: "0.9",
    themes: "회복,안정",
    active: true,
  });

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/quotes");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "목록 실패");
        return;
      }
      setQuotes(data.quotes ?? []);
    } catch {
      setError("목록 요청 실패");
    } finally {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteTextKo: form.quoteTextKo,
          authorName: form.authorName || null,
          workTitle: form.workTitle || null,
          sourceUrl: form.sourceUrl || null,
          rightsStatus: form.rightsStatus,
          verificationStatus: form.verificationStatus,
          attributionConfidence: Number(form.attributionConfidence),
          themes: form.themes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          emotionalTone: ["차분"],
          suitableStates: [],
          unsuitableStates: [],
          active: form.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      setForm((f) => ({ ...f, quoteTextKo: "" }));
      await refresh();
    } catch {
      setError("저장 요청 실패");
    } finally {
      setStatus("idle");
    }
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/admin/quotes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await refresh();
  };

  return (
    <div className="space-y-3">
      <textarea
        className="w-full p-2 border text-sm min-h-[72px]"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        placeholder="명언 본문 (한국어)"
        value={form.quoteTextKo}
        onChange={(e) => setForm((f) => ({ ...f, quoteTextKo: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          placeholder="작가"
          value={form.authorName}
          onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
        />
        <input
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          placeholder="작품"
          value={form.workTitle}
          onChange={(e) => setForm((f) => ({ ...f, workTitle: e.target.value }))}
        />
      </div>
      <input
        className="w-full p-2 border text-xs"
        style={{ borderColor: "var(--px-border)" }}
        placeholder="출처 URL"
        value={form.sourceUrl}
        onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-2 text-xs">
        <select
          className="p-2 border"
          style={{ borderColor: "var(--px-border)" }}
          value={form.rightsStatus}
          onChange={(e) => setForm((f) => ({ ...f, rightsStatus: e.target.value }))}
        >
          <option value="public_domain">public_domain</option>
          <option value="licensed">licensed</option>
          <option value="permission_granted">permission_granted</option>
          <option value="internally_written">internally_written</option>
          <option value="review_required">review_required</option>
          <option value="prohibited">prohibited</option>
        </select>
        <select
          className="p-2 border"
          style={{ borderColor: "var(--px-border)" }}
          value={form.verificationStatus}
          onChange={(e) =>
            setForm((f) => ({ ...f, verificationStatus: e.target.value }))
          }
        >
          <option value="primary_source_verified">primary_source_verified</option>
          <option value="reputable_secondary_verified">
            reputable_secondary_verified
          </option>
          <option value="translation_verified">translation_verified</option>
          <option value="unverified">unverified</option>
          <option value="rejected">rejected</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
        />
        active (사용자 노출)
      </label>
      <button
        type="button"
        className="px-btn w-full py-2 text-sm"
        disabled={status === "saving" || !form.quoteTextKo.trim()}
        onClick={() => void save()}
      >
        {status === "saving" ? "저장 중…" : "명언 등록/검수 저장"}
      </button>
      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {quotes.map((q) => (
          <li
            key={q.id}
            className="p-2 border text-xs space-y-1"
            style={{ borderColor: "var(--px-border)" }}
          >
            <p style={{ color: "var(--px-text)" }}>{q.quoteTextKo}</p>
            <p style={{ color: "var(--px-text2)" }}>
              {[q.authorName, q.workTitle].filter(Boolean).join(" · ") || "출처 없음"}{" "}
              · {q.verificationStatus} · {q.rightsStatus} ·{" "}
              {q.active ? "active" : "off"}
            </p>
            {q.active && (
              <button
                type="button"
                className="underline"
                onClick={() => void deactivate(q.id)}
              >
                즉시 비활성
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
