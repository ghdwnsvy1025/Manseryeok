"use client";

import { useMemo, useState } from "react";
import type { JournalEntry } from "@/lib/journal/types";
import type { JournalStorage } from "@/lib/journal/storage";
import {
  journalEntryToSaveInput,
  planLocalJournalImport,
  resolveJournalConflicts,
  type JournalMergeChoice,
  type JournalMergePlan,
} from "@/lib/journal/mergeLocalJournalImport";

type Props = {
  localEntries: JournalEntry[];
  remoteEntries: JournalEntry[];
  remoteStorage: JournalStorage;
  remoteSajuProfileId: string;
  onSkip: () => void;
  onComplete: () => void;
};

export default function LocalJournalImportPanel({
  localEntries,
  remoteEntries,
  remoteStorage,
  remoteSajuProfileId,
  onSkip,
  onComplete,
}: Props) {
  const plan: JournalMergePlan = useMemo(
    () => planLocalJournalImport(localEntries, remoteEntries),
    [localEntries, remoteEntries]
  );
  const [choices, setChoices] = useState<Record<string, JournalMergeChoice>>(
    () => {
      const initial: Record<string, JournalMergeChoice> = {};
      for (const conflict of plan.conflicts) {
        initial[conflict.date] = "local";
      }
      return initial;
    }
  );
  const [status, setStatus] = useState<
    "idle" | "importing" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const nothingToImport =
    plan.toUpload.length === 0 && plan.conflicts.length === 0;

  const handleImport = async () => {
    setStatus("importing");
    setMessage("");
    try {
      const resolved = resolveJournalConflicts(plan.conflicts, choices);
      const payload = [...plan.toUpload, ...resolved];
      for (const entry of payload) {
        const input = journalEntryToSaveInput(entry, remoteSajuProfileId);
        if (remoteStorage.saveWithMeta) {
          await remoteStorage.saveWithMeta(input);
        } else {
          await remoteStorage.save(input);
        }
      }
      setStatus("done");
      setMessage(
        `가져오기 완료 (${payload.length}건). 이 기기 백업은 그대로 남겨 두었습니다.`
      );
      onComplete();
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "가져오기에 실패했습니다."
      );
    }
  };

  if (nothingToImport) {
    return (
      <div
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
      >
        <p
          className="text-sm font-bold"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          가져올 새 로컬 기록이 없습니다.
        </p>
        <button
          type="button"
          onClick={onSkip}
          className="ui-primary-btn w-full py-2 text-sm"
        >
          홈으로
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
        이 기기 기록 가져오기
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
        비로그인으로 쓴 일기 {localEntries.length}건을 Google 계정으로 옮길 수
        있어요. 가져오기 전까지 이 기기 데이터는 지우지 않습니다.
      </p>
      <p
        className="text-xs font-bold"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        새 기록 {plan.toUpload.length}건 · 날짜 충돌 {plan.conflicts.length}건
      </p>

      {plan.conflicts.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {plan.conflicts.map((conflict) => (
            <div
              key={conflict.date}
              className="p-2 border space-y-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
            >
              <p
                className="text-xs font-bold"
                style={{ color: "var(--px-accent)" }}
              >
                {conflict.date}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-[11px] space-y-1 cursor-pointer">
                  <span
                    className="font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    이 기기
                  </span>
                  <p
                    className="line-clamp-2"
                    style={{ color: "var(--px-text)" }}
                  >
                    {conflict.local.content || "(내용 없음)"}
                    {conflict.local.happinessScore != null
                      ? ` · ${conflict.local.happinessScore}점`
                      : ""}
                  </p>
                  <input
                    type="radio"
                    name={`j-merge-${conflict.date}`}
                    checked={choices[conflict.date] === "local"}
                    onChange={() =>
                      setChoices((prev) => ({
                        ...prev,
                        [conflict.date]: "local",
                      }))
                    }
                  />
                </label>
                <label className="text-[11px] space-y-1 cursor-pointer">
                  <span
                    className="font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    계정
                  </span>
                  <p
                    className="line-clamp-2"
                    style={{ color: "var(--px-text)" }}
                  >
                    {conflict.remote.content || "(내용 없음)"}
                    {conflict.remote.happinessScore != null
                      ? ` · ${conflict.remote.happinessScore}점`
                      : ""}
                  </p>
                  <input
                    type="radio"
                    name={`j-merge-${conflict.date}`}
                    checked={choices[conflict.date] === "remote"}
                    onChange={() =>
                      setChoices((prev) => ({
                        ...prev,
                        [conflict.date]: "remote",
                      }))
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
          onClick={() => void handleImport()}
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
