"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { track } from "@/lib/analytics";

/**
 * 나 탭 낱장(팝업) — 명세 47 (톤 v3.51). 만세력 · "나는 언제 행복했지?" · "예상은 맞았을까?" 셋이 같은 틀.
 * 아래에서 올라오는 한지 낱장, 높이는 화면의 9할, 안에서 세로로 민다. 머리에 뇌문 띠 + 매듭(운세 카드 섞은 톤과 같은 문양 — 낱장 머리에만).
 * <dialog>.showModal(): 뒤 화면은 inert, 포커스는 낱장 안에 갇히고, 닫히면 연 버튼으로 돌아간다.
 * 닫기: 머리의 "닫기" · 바깥(어두운 막) 누르기 · Esc · 머리를 잡고 아래로 밀기. 낱장 안의 같은 창 링크를 누르면 바로 닫힌다(달력의 그날로 간다).
 * 모션: 올라옴 240ms · 내려감 180ms, 막은 흐려짐만. reduced-motion이면 움직임 없이 나타난다(globals.css .sheet*).
 * 여는 쪽은 SheetTrigger(같은 id) 또는 initialOpen(주소 ?saju=open).
 */
const OPEN_EVENT = "sheet:open";
const CLOSE_MS = 180;
/** 이만큼(px) 아래로 밀고 놓으면 닫힌다 */
const DRAG_CLOSE = 90;

export function openSheet(id: string): void {
  document.getElementById(id)?.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function Sheet({ id, name, title, initialOpen = false, children }: { id: string; /** 이용 통계에 남는 이름 */ name: "saju" | "happy" | "versus" | "day"; title: string; initialOpen?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closing = useRef<number | null>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const titleId = useId();

  const finish = useCallback(() => {
    const d = ref.current;
    if (!d) return;
    if (closing.current !== null) window.clearTimeout(closing.current);
    closing.current = null;
    d.removeAttribute("data-closing");
    d.style.removeProperty("--sheet-from");
    if (paper.current) paper.current.style.transform = "";
    if (d.open) d.close();
    // dialog가 스스로 돌려주지만, 연 버튼이 다시 그려진 경우에도 돌아가게 한 번 더
    const o = opener.current;
    opener.current = null;
    if (o && document.contains(o)) o.focus({ preventScroll: true });
  }, []);

  const close = useCallback(
    (instant = false) => {
      const d = ref.current;
      if (!d || !d.open || closing.current !== null) return;
      const still = instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) return finish();
      d.setAttribute("data-closing", "");
      closing.current = window.setTimeout(finish, CLOSE_MS);
    },
    [finish],
  );

  const open = useCallback(() => {
    const d = ref.current;
    if (!d || d.open) return;
    opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    d.showModal();
    // 포커스는 낱장 머리(제목)로 — 보조 기술은 제목부터 읽고, 다음 Tab이 "닫기"다
    d.querySelector<HTMLElement>(".sheet__title")?.focus({ preventScroll: true });
    d.querySelector<HTMLElement>(".sheet__body")?.scrollTo(0, 0);
    track("me_sheet_open", { sheet: name });
  }, [name]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    d.addEventListener(OPEN_EVENT, open);
    return () => d.removeEventListener(OPEN_EVENT, open);
  }, [open]);

  // 주소로 열린 채 시작 (?saju=open) — 처음 한 번
  useEffect(() => {
    if (initialOpen) open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (closing.current !== null) window.clearTimeout(closing.current);
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      id={id}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc: 바로 사라지지 않고 내려가는 모션을 거친다
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        // 바깥(어두운 막)
        if (t === ref.current || t.classList.contains("sheet__film")) return close();
        // 낱장 안의 같은 창 링크(가장 행복했던 날 → 달력의 그날, 생년월일 고치기): 낱장을 바로 걷고 간다
        const a = t.closest("a[href]");
        if (a && a.getAttribute("target") !== "_blank") close(true);
      }}
    >
      <div className="sheet__film" aria-hidden />
      <div ref={paper} className="sheet__paper card-paper">
        {/* 머리: 뇌문 띠 + 매듭(장식, aria-hidden) → 닫기 → 제목. 띠를 잡고 아래로 밀면 닫힌다 */}
        <header
          className="sheet__head"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button, a")) return;
            drag.current = { y: e.clientY, dy: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = drag.current;
            if (!g || !paper.current) return;
            g.dy = Math.max(0, e.clientY - g.y);
            paper.current.style.transition = "none";
            paper.current.style.transform = `translateY(${g.dy}px)`;
          }}
          onPointerUp={() => {
            const g = drag.current;
            drag.current = null;
            if (!g || !paper.current) return;
            paper.current.style.transition = "";
            if (g.dy > DRAG_CLOSE) {
              // 놓은 자리에서 이어서 내려간다
              ref.current?.style.setProperty("--sheet-from", `${g.dy}px`);
              paper.current.style.transform = "";
              close();
            } else paper.current.style.transform = "";
          }}
          onPointerCancel={() => {
            drag.current = null;
            if (paper.current) {
              paper.current.style.transition = "";
              paper.current.style.transform = "";
            }
          }}
        >
          <span aria-hidden className="sheet__band" />
          <span aria-hidden className="sheet__knot" />
          <div className="sheet__bar">
            <button type="button" className="sheet__close tap" onClick={() => close()}>
              닫기
            </button>
          </div>
          <h2 id={titleId} className="sheet__title" tabIndex={-1}>
            {title}
          </h2>
        </header>
        <div className="sheet__body">{children}</div>
      </div>
    </dialog>
  );
}

/** 낱장을 여는 버튼. 모양은 className으로(여덟 글자 줄 · 물음 인장). locked면 눌러도 열리지 않는다 — 까닭은 버튼 안 글이 말한다 */
export function SheetTrigger({ target, locked = false, className, children, ...rest }: { target: string; locked?: boolean; className?: string; children: ReactNode; id?: string; "aria-label"?: string }) {
  return (
    <button
      type="button"
      {...rest}
      className={className}
      aria-haspopup="dialog"
      aria-disabled={locked || undefined}
      data-locked={locked ? "" : undefined}
      onClick={() => {
        if (!locked) openSheet(target);
      }}
    >
      {children}
    </button>
  );
}
