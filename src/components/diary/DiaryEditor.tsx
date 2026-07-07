"use client";

import { useCallback, useEffect, useState } from "react";
import DayPillarBadge from "@/components/diary/DayPillarBadge";
import DiaryCalendar from "@/components/diary/DiaryCalendar";
import AnalysisResult from "@/components/diary/AnalysisResult";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getPillarsForDate, resolveDateString } from "@/lib/diary/dayPillar";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import type { DiaryEntry } from "@/lib/diary/types";

type Props = {
  initialDate?: string;
};

export default function DiaryEditor({ initialDate }: Props) {
  const [date, setDate] = useState(() => resolveDateString(initialDate));
  const [content, setContent] = useState("");
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [monthPillarKo, setMonthPillarKo] = useState<string>("");
  const [dayPillarKo, setDayPillarKo] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "analyzing">("loading");
  const [message, setMessage] = useState("");

  const loadEntry = useCallback(async (targetDate: string) => {
    setStatus("loading");
    setMessage("");
    try {
      const pillars = getPillarsForDate(targetDate);
      setMonthPillarKo(pillars.monthPillarKo);
      setDayPillarKo(pillars.dayPillar.ganjiKo);

      const storage = await getDiaryStorage();
      const existing = await storage.getByDate(targetDate);
      if (existing) {
        setEntry(existing);
        setContent(existing.content);
      } else {
        setEntry(null);
        setContent("");
      }
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "일기를 불러오지 못했습니다.");
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    loadEntry(date);
  }, [date, loadEntry]);

  const handleSave = async () => {
    if (!content.trim()) {
      setMessage("일기 내용을 입력해주세요.");
      return;
    }

    setStatus("saving");
    setMessage("");
    try {
      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const base = entry ?? createDiaryEntry(date, content.trim());
      const updated: DiaryEntry = {
        ...base,
        content: content.trim(),
        updatedAt: now,
        createdAt: entry?.createdAt ?? now,
      };
      await storage.save(updated);
      setEntry(updated);
      setMessage("저장되었습니다.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleAnalyze = async () => {
    if (!content.trim()) {
      setMessage("분석할 일기 내용을 입력해주세요.");
      return;
    }

    setStatus("analyzing");
    setMessage("AI가 감정을 분석 중입니다...");
    try {
      const res = await fetch("/api/diary/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          date,
          dayPillarKo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "분석에 실패했습니다.");
      }

      const storage = await getDiaryStorage();
      const now = new Date().toISOString();
      const base = entry ?? createDiaryEntry(date, content.trim());
      const updated: DiaryEntry = {
        ...base,
        content: content.trim(),
        analysis: data.analysis as DiaryAnalysis,
        updatedAt: now,
        createdAt: entry?.createdAt ?? now,
      };
      await storage.save(updated);
      setEntry(updated);
      setMessage("AI 분석이 완료되어 저장되었습니다.");
      setStatus("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "분석에 실패했습니다.");
      setStatus("idle");
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirm("이 날짜의 일기를 삭제할까요?")) return;

    try {
      const storage = await getDiaryStorage();
      await storage.delete(entry.id);
      setEntry(null);
      setContent("");
      setMessage("삭제되었습니다.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  const pillars = entry?.dayPillar ?? getPillarsForDate(date).dayPillar;
  const monthKo = entry?.monthPillarKo ?? monthPillarKo;
  const isBusy = status === "loading" || status === "saving" || status === "analyzing";

  return (
    <div className="space-y-4">
      <DiaryCalendar date={date} onChange={(d) => setDate(resolveDateString(d))} />

      <DayPillarBadge monthPillarKo={monthKo} dayPillar={pillars} />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="오늘 하루는 어땠나요? 자유롭게 적어주세요."
        rows={10}
        disabled={isBusy}
        className="w-full px-3 py-2 text-sm border-2 resize-y"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border)",
          color: "var(--px-text)",
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isBusy}
          className="px-4 py-2 text-xs font-bold border-2"
          style={{
            background: "var(--px-accent)",
            borderColor: "#000",
            color: "#000",
            boxShadow: "3px 3px 0 #000",
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {status === "saving" ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isBusy}
          className="px-4 py-2 text-xs font-bold border-2"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border2)",
            color: "var(--px-accent)",
            boxShadow: "3px 3px 0 #000",
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {status === "analyzing" ? "분석 중..." : "AI 분석"}
        </button>
        {entry && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isBusy}
            className="px-4 py-2 text-xs font-bold border-2"
            style={{
              background: "var(--px-bg2)",
              borderColor: "#f87171",
              color: "#f87171",
            }}
          >
            삭제
          </button>
        )}
      </div>

      {message && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {message}
        </p>
      )}

      {entry?.analysis && (
        <div
          className="p-3 border-2 space-y-3"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        >
          <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
            ■ AI 감정 분석
          </p>
          <AnalysisResult analysis={entry.analysis} />
        </div>
      )}
    </div>
  );
}
