"use client";

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <ellipse cx="8" cy="8" rx="6" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
      <path
        d="M2.5 8s2.2-3.5 5.5-3.5S13.5 8 13.5 8s-2.2 3.5-5.5 3.5S2.5 8 2.5 8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  visible: boolean;
  onClick: () => void;
  popping?: boolean;
};

export default function PillarVisibilityToggle({ visible, onClick, popping }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pillar-visibility-btn flex items-center justify-center border w-[22px] h-[18px] ${popping ? "is-popping" : ""}`}
      style={{
        borderColor: visible ? "var(--px-accent)" : "var(--px-text2)",
        color: visible ? "var(--px-accent)" : "var(--px-text2)",
        background: visible ? "var(--px-bg3)" : "var(--px-bg2)",
      }}
      aria-label={visible ? "간지 숨기기" : "간지 표시하기"}
      aria-pressed={visible}
      title={visible ? "간지 표시 중 (터치하면 숨김)" : "간지 숨김 (터치하면 표시)"}
    >
      {visible ? <EyeOpenIcon /> : <EyeOffIcon />}
    </button>
  );
}

export function PillarVisibilityToggleSpacer() {
  return (
    <span className="invisible flex items-center justify-center border w-[22px] h-[18px]" aria-hidden>
      <EyeOpenIcon />
    </span>
  );
}
