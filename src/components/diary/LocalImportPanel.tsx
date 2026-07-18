"use client";

import { useMemo, useState } from "react";
import type { DiaryEntry } from "@/lib/diary/types";
import {
  planLocalImport,
  resolveConflicts,
  type DiaryMergeChoice,
  type DiaryMergePlan,
} from "@/lib/diary/mergeLocalImport";
import type { DiaryStorage } from "@/lib/diary/storage";

type Props = {
  localEntries: DiaryEntry[];
  remoteEntries: DiaryEntry[];
  remoteStorage: DiaryStorage;
  onSkip: () => void;
  onComplete: () => void;
};

export default function LocalImportPanel({
  localEntries,
  remoteEntries,
  remoteStorage,
  onSkip,
  onComplete,
}: Props) {
  const plan: DiaryMergePlan = useMemo(
    () => planLocalImport(localEntries, remoteEntries),
    [localEntries, remoteEntries]
  );
  const [choices, setChoices] = useState<Record<string, DiaryMergeChoice>>(() => {
    const initial: Record<string, DiaryMergeChoice> = {};
    for (const conflict of plan.conflicts) {
      initial[conflict.date] = "local";
    }
    return initial;
  });
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const nothingToImport =
    plan.toUpload.length === 0 && plan.conflicts.length === 0;

  const handleImport = async () => {
    setStatus("importing");
    setMessage("");
    try {
      const resolved = resolveConflicts(plan.conflicts, choices);
      const payload = [...plan.toUpload, ...resolved];
      if (payload.length > 0) {
        await remoteStorage.upsertMany(payload);
      }
      setStatus("done");
      setMessage(
        `가져오기 완료 (${payload.length}건). 로컬 백업은 그대로 남겨 두었습니다.`
      );
      onComplete();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "가져오기에 실패했습니다.");
    }
  };

  if (nothingToImport) {
    return (
      <div
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
      >
        <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
          가져올 새 로컬 기록이 없습니다.
        </p>
        <button type="button" onClick={onSkip} className="ui-primary-btn w-full py-2 text-sm">
          일기로 이동
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-4 border-2 space-y-3"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
    >
      <h3 className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
        로컬 기록 가져오기
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
        이 기기에 저장된 일기 {localEntries.length}건을 계정으로 옮길 수 있습니다.
        성공하기 전까지 로컬 데이터는 삭제하지 않습니다.
      </p>
      <p className="text-xs font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        새 기록 {plan.toUpload.length}건 · 날짜 충돌 {plan.conflicts.length}건
      </p>

      {plan.conflicts.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {plan.conflicts.map((conflict) => (
            <div
              key={conflict.date}
              className="p-2 border space-y-2"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
            >
              <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
                {conflict.date}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-[11px] space-y-1 cursor-pointer">
                  <span className="font-bold" style={{ color: "var(--px-text2)" }}>
                    로컬
                  </span>
                  <p className="line-clamp-2" style={{ color: "var(--px-text)" }}>
                    {conflict.local.content}
                    {conflict.local.happinessRating
                      ? ` · ${conflict.local.happinessRating}점`
                      : ""}
                  </p>
                  <input
                    type="radio"
                    name={`merge-${conflict.date}`}
                    checked={choices[conflict.date] === "local"}
                    onChange={() =>
                      setChoices((prev) => ({ ...prev, [conflict.date]: "local" }))
                    }
                  />
                </label>
                <label className="text-[11px] space-y-1 cursor-pointer">
                  <span className="font-bold" style={{ color: "var(--px-text2)" }}>
                    계정
                  </span>
                  <p className="line-clamp-2" style={{ color: "var(--px-text)" }}>
                    {conflict.remote.content}
                    {conflict.remote.happinessRating
                      ? ` · ${conflict.remote.happinessRating}점`
                      : ""}
                  </p>
                  <input
                    type="radio"
                    name={`merge-${conflict.date}`}
                    checked={choices[conflict.date] === "remote"}
                    onChange={() =>
                      setChoices((prev) => ({ ...prev, [conflict.date]: "remote" }))
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleImport}
          disabled={status === "importing"}
          className="ui-primary-btn flex-1 py-2 text-sm"
        >
          {status === "importing" ? "가져오는 중..." : "선택한 기록 가져오기"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={status === "importing"}
          className="flex-1 px-3 py-2 text-xs font-bold border"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
        >
          나중에 / 건너뛰기
        </button>
      </div>

      {message && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
