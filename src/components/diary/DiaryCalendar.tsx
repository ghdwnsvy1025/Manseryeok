"use client";

type Props = {
  date: string;
  onChange: (date: string) => void;
};

export default function DiaryCalendar({ date, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="diary-date"
        className="text-xs font-bold shrink-0"
        style={{ color: "var(--px-text2)" }}
      >
        날짜
      </label>
      <input
        id="diary-date"
        type="date"
        value={date}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1.5 text-sm border-2 font-bold"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border)",
          color: "var(--px-text)",
        }}
      />
    </div>
  );
}
