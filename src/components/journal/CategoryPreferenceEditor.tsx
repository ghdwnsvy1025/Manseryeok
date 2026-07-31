"use client";

import { useMemo, useState } from "react";
import { CATEGORY_CATALOG } from "@/lib/journal/categoryCatalog";
import {
  MAX_ENABLED_CATEGORIES,
  MIN_ENABLED_CATEGORIES,
  RECOMMENDED_ENABLED_CATEGORIES,
  type CategoryCode,
} from "@/lib/journal/types";
import { validateEnabledCategorySelection } from "@/lib/journal/validation";

type Props = {
  initialEnabled: CategoryCode[];
  onSave: (enabledOrdered: CategoryCode[]) => Promise<void> | void;
  submitLabel?: string;
};

export default function CategoryPreferenceEditor({
  initialEnabled,
  onSave,
  submitLabel = "저장",
}: Props) {
  const [selected, setSelected] = useState<CategoryCode[]>(initialEnabled);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const count = selected.length;
  const hint = useMemo(() => {
    if (count < MIN_ENABLED_CATEGORIES) {
      return `최소 ${MIN_ENABLED_CATEGORIES}개`;
    }
    if (count > MAX_ENABLED_CATEGORIES) {
      return `최대 ${MAX_ENABLED_CATEGORIES}개`;
    }
    return `${count}개 선택`;
  }, [count]);

  const toggle = (code: CategoryCode) => {
    setError("");
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= MAX_ENABLED_CATEGORIES) {
        setError(`최대 ${MAX_ENABLED_CATEGORIES}개까지`);
        return prev;
      }
      return [...prev, code];
    });
  };

  const move = (code: CategoryCode, dir: -1 | 1) => {
    setSelected((prev) => {
      const idx = prev.indexOf(code);
      if (idx < 0) return prev;
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    const check = validateEnabledCategorySelection(selected);
    if (!check.ok) {
      setError(check.error ?? "선택을 확인해주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSave(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const orderedSelected = selected
    .map((code) => CATEGORY_CATALOG.find((c) => c.code === code))
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="stats-category-panel">
        <div className="flex items-center justify-between gap-2">
          <p className="stats-category-title">카테고리</p>
          <p className="stats-label">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_CATALOG.map((cat) => {
            const on = selected.includes(cat.code);
            return (
              <button
                key={cat.code}
                type="button"
                onClick={() => toggle(cat.code)}
                className={`stats-chip-cat${on ? " is-on" : ""}`}
                aria-pressed={on}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {orderedSelected.length > 0 && (
        <div className="space-y-2">
          <p className="stats-label">순서</p>
          <ul className="space-y-1.5">
            {orderedSelected.map((cat, order) => {
              if (!cat) return null;
              return (
                <li
                  key={cat.code}
                  className="flex items-center gap-2 px-3 py-2 border-2"
                  style={{
                    borderColor: "var(--px-border)",
                    background: "var(--px-bg2)",
                  }}
                >
                  <span
                    className="text-sm font-black tabular-nums w-5"
                    style={{ color: "var(--px-accent)" }}
                  >
                    {order + 1}
                  </span>
                  <span
                    className="flex-1 text-sm font-bold truncate"
                    style={{ color: "var(--px-text-on-panel)" }}
                  >
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-bold underline"
                    style={{ color: "var(--px-text2)" }}
                    onClick={() => move(cat.code, -1)}
                    disabled={order <= 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold underline"
                    style={{ color: "var(--px-text2)" }}
                    onClick={() => move(cat.code, 1)}
                    disabled={order === orderedSelected.length - 1}
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="ui-primary-btn w-full py-3.5 text-base font-black"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "저장 중…" : submitLabel}
      </button>
    </div>
  );
}
