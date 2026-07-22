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
      return `최소 ${MIN_ENABLED_CATEGORIES}개 선택 (현재 ${count})`;
    }
    if (count > MAX_ENABLED_CATEGORIES) {
      return `최대 ${MAX_ENABLED_CATEGORIES}개까지`;
    }
    if (count === RECOMMENDED_ENABLED_CATEGORIES) {
      return `권장 ${RECOMMENDED_ENABLED_CATEGORIES}개와 같아요`;
    }
    return `권장 ${RECOMMENDED_ENABLED_CATEGORIES}개 · 현재 ${count}개`;
  }, [count]);

  const toggle = (code: CategoryCode) => {
    setError("");
    setSelected((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= MAX_ENABLED_CATEGORIES) {
        setError(`최대 ${MAX_ENABLED_CATEGORIES}개까지 선택할 수 있어요.`);
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

  return (
    <div className="space-y-3">
      <p className="ui-hint">{hint}</p>
      <ul className="space-y-2">
        {CATEGORY_CATALOG.map((cat) => {
          const on = selected.includes(cat.code);
          const order = selected.indexOf(cat.code);
          return (
            <li
              key={cat.code}
              className="p-3 border-2 space-y-1"
              style={{
                borderColor: on ? "var(--px-accent)" : "var(--px-border)",
                background: "var(--px-bg2)",
              }}
            >
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(cat.code)}
                  className="mt-1"
                  aria-label={`${cat.name} 선택`}
                />
                <span className="flex-1">
                  <span className="text-sm font-black block" style={{ color: "var(--px-accent)" }}>
                    {cat.name}
                  </span>
                  <span className="text-xs block" style={{ color: "var(--px-text2)" }}>
                    {cat.question}
                  </span>
                </span>
              </label>
              {on && (
                <div className="flex gap-2 pl-6">
                  <button
                    type="button"
                    className="text-[11px] font-bold underline"
                    style={{ color: "var(--px-text2)" }}
                    onClick={() => move(cat.code, -1)}
                    disabled={order <= 0}
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-bold underline"
                    style={{ color: "var(--px-text2)" }}
                    onClick={() => move(cat.code, 1)}
                    disabled={order === selected.length - 1}
                  >
                    아래로
                  </button>
                  <span className="ui-hint">순서 {order + 1}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="text-xs font-bold" style={{ color: "#f87171" }} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="ui-primary-btn w-full py-3 text-sm"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "저장 중…" : submitLabel}
      </button>
    </div>
  );
}
