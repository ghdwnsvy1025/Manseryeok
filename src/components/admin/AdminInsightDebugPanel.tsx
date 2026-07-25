"use client";

import { useState } from "react";

export default function AdminInsightDebugPanel() {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ date });
      if (userId.trim()) qs.set("userId", userId.trim());
      const res = await fetch(`/api/admin/daily-insight?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "조회 실패");
        return;
      }
      setResult(data);
    } catch {
      setError("요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className="p-2 border text-xs"
          style={{ borderColor: "var(--px-border)" }}
          placeholder="userId (선택)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="px-btn w-full py-2 text-sm"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? "조회 중…" : "인사이트/운세/문장 근거 조회"}
      </button>
      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
      {result != null && (
        <pre
          className="text-[10px] p-2 border overflow-auto max-h-72"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg3)",
            color: "var(--px-text2)",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
