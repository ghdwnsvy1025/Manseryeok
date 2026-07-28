"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import {
  buildRandomMonthSeedInput,
  isMonthSeedEntry,
  monthSeedStatusSummary,
  parseYearMonth,
  planMonthSeed,
} from "@/lib/journal/seed/monthSequential";
import { clearCheckInDrafts } from "@/lib/journal/checkin/draft";
import { notifyJournalProgressChanged } from "@/lib/journal/streak";
import {
  loadPrimarySajuProfile,
  profileDisplayName,
} from "@/lib/diary/profileStorage";
import type { CategoryCode } from "@/lib/journal/types";

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminJournalMonthSeedPanel() {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [count, setCount] = useState(10);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [contiguousEnd, setContiguousEnd] = useState(0);
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [nextAddDate, setNextAddDate] = useState<string | null>(null);
  const [seededDates, setSeededDates] = useState<string[]>([]);
  const [profileLabel, setProfileLabel] = useState<string>("(확인 중…)");

  const yearMonthOk = useMemo(
    () => Boolean(parseYearMonth(yearMonth)),
    [yearMonth]
  );

  const refresh = useCallback(async () => {
    const profile = await loadPrimarySajuProfile();
    setProfileLabel(
      profile
        ? `${profileDisplayName(profile)} (${profile.id.slice(0, 8)}…)`
        : "프로필 없음 · 로컬 저장"
    );

    if (!parseYearMonth(yearMonth)) return;
    const storage = await getJournalStorage();
    const list = await storage.list();
    const summary = monthSeedStatusSummary(yearMonth, list);
    setContiguousEnd(summary.contiguousEnd);
    setDaysInMonth(summary.daysInMonth);
    setNextAddDate(summary.nextAddDate);
    setSeededDates(summary.seededDates);
  }, [yearMonth]);

  useEffect(() => {
    void refresh().catch(() => {
      /* ignore first load errors */
    });
  }, [refresh]);

  const run = async (action: "add" | "delete") => {
    setStatus("loading");
    setMessage(action === "add" ? "시드 추가 중…" : "시드 삭제 중…");
    try {
      const profile = await loadPrimarySajuProfile();
      setProfileLabel(
        profile
          ? `${profileDisplayName(profile)} (${profile.id.slice(0, 8)}…)`
          : "프로필 없음 · 로컬 저장"
      );

      const storage = await getJournalStorage();
      if (action === "delete" && typeof storage.deleteByDate !== "function") {
        throw new Error("현재 저장소는 삭제를 지원하지 않습니다.");
      }
      const list = await storage.list();
      const plan = planMonthSeed({
        yearMonth,
        count,
        action,
        entries: list,
      });
      if ("error" in plan) {
        setStatus("error");
        setMessage(plan.error);
        return;
      }

      if (action === "delete") {
        if (plan.deleteDates.length === 0) {
          setStatus("error");
          setMessage(
            plan.deleteBlockedReason ?? "삭제할 시드가 없습니다."
          );
          await refresh();
          return;
        }
        let deleted = 0;
        const deletedDates: string[] = [];
        for (const date of plan.deleteDates) {
          const existing = await storage.getByDate(date);
          if (!existing || !isMonthSeedEntry(existing)) {
            continue;
          }
          const ok = await storage.deleteByDate!(date);
          if (ok) {
            deleted += 1;
            deletedDates.push(date);
          }
        }
        clearCheckInDrafts(deletedDates);
        if (deleted === 0) {
          setStatus("error");
          setMessage(
            plan.deleteBlockedReason ??
              `${yearMonth}에 삭제할 시드 데이터가 없습니다.`
          );
        } else {
          setStatus("done");
          const removed = plan.deleteDates.slice(0, deleted);
          const range =
            removed.length > 1
              ? `${removed[removed.length - 1]} ~ ${removed[0]}`
              : removed[0];
          const tail = plan.clamped
            ? ` ${plan.deleteBlockedReason}`
            : ` 남은 시드는 ${plan.resultingEnd}개입니다.`;
          setMessage(`${deleted}일분 시드를 삭제했습니다 (${range}).${tail}`);
          notifyJournalProgressChanged();
        }
        await refresh();
        return;
      }

      if (plan.addDates.length === 0) {
        setStatus("error");
        setMessage(plan.addBlockedReason ?? "추가할 날짜가 없습니다.");
        await refresh();
        return;
      }

      const prefs = await storage.getPreferences();
      const enabledCodes = getEnabledCodesOrdered(prefs) as CategoryCode[];
      let added = 0;
      const addedDates: string[] = [];
      for (const date of plan.addDates) {
        const existing = await storage.getByDate(date);
        if (existing && !isMonthSeedEntry(existing)) {
          setStatus("error");
          setMessage(
            `${date}에 시드가 아닌 실제 일기가 있어 중단했습니다. (추가 ${added}일분 완료)`
          );
          await refresh();
          return;
        }
        await storage.save(
          buildRandomMonthSeedInput(date, {
            enabledCodes,
            sajuProfileId: profile?.id ?? null,
          })
        );
        clearCheckInDrafts([date]);
        added += 1;
        addedDates.push(date);
      }
      setStatus("done");
      const range =
        addedDates.length > 1
          ? `${addedDates[0]} ~ ${addedDates[addedDates.length - 1]}`
          : addedDates[0];
      const tail = plan.clamped
        ? ` ${plan.addBlockedReason}`
        : ` 현재 ${plan.resultingEnd}/${plan.daysInMonth}일까지 채워졌습니다.`;
      setMessage(`${added}일분 시드를 추가했습니다 (${range}).${tail}`);
      notifyJournalProgressChanged();
      await refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-bold text-sm" style={{ color: "var(--px-accent)" }}>
        월 단위 저널 시드 (테스트용)
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
        선택한 달의 1일부터 순차로 채웁니다. 예: 7월에 10개 → 1~10일, 이어서 3개 →
        11~13일. 삭제도 끝에서부터 시드만 제거합니다. 오늘의 기록·필수(행복도·기분·핵심
        상태)·선택(태그·생활영역)을 랜덤으로 채웁니다.
      </p>
      <p className="text-[11px] font-bold" style={{ color: "var(--px-text)" }}>
        대상 프로필: {profileLabel}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs space-y-1">
          <span style={{ color: "var(--px-text2)" }}>월 (YYYY-MM)</span>
          <input
            type="month"
            className="w-full px-2 py-1.5 text-sm border"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
              color: "var(--px-text)",
            }}
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
        <label className="text-xs space-y-1">
          <span style={{ color: "var(--px-text2)" }}>개수</span>
          <input
            type="number"
            min={1}
            max={31}
            className="w-full px-2 py-1.5 text-sm border"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
              color: "var(--px-text)",
            }}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
          />
        </label>
      </div>

      <p className="text-[11px]" style={{ color: "var(--px-text2)" }}>
        {yearMonthOk ? (
          <>
            연속 시드 <strong>{contiguousEnd}</strong>/{daysInMonth}일
            {nextAddDate ? ` · 다음 추가 ${nextAddDate}` : " · 월말까지 가득 참"}
            {seededDates.length > 0
              ? ` · 현재 ${seededDates[0]}~${seededDates[seededDates.length - 1]}`
              : ""}
          </>
        ) : (
          "월 형식을 확인하세요."
        )}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="px-btn py-2 text-sm"
          disabled={status === "loading" || !yearMonthOk}
          onClick={() => void run("add")}
        >
          {status === "loading" ? "[ 처리 중… ]" : "[ 시드 추가 ]"}
        </button>
        <button
          type="button"
          className="px-btn py-2 text-sm"
          disabled={status === "loading" || !yearMonthOk}
          onClick={() => void run("delete")}
        >
          {status === "loading" ? "[ 처리 중… ]" : "[ 시드 삭제 ]"}
        </button>
      </div>

      {message && (
        <p
          className="text-xs font-bold leading-relaxed"
          style={{
            color:
              status === "error"
                ? "#f87171"
                : status === "done"
                  ? "#4ade80"
                  : "var(--px-text2)",
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
