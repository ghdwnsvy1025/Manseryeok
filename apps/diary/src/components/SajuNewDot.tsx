"use client";

import { useEffect, useState } from "react";

/** 이 기기에서 만세력 낱장을 연 적이 있는지 (명세 48 더하기 3). DB에는 남기지 않는다 */
const SEEN_KEY = "saju-sheet-seen";

/**
 * 내 사주 접힌 줄의 "처음 한 번" 붉은 점 (명세 48 더하기, 톤 v3.52): 이 기기에서 만세력 낱장을 한 번도 안 열었으면 버튼 글귀 옆에 인주색 6px 점.
 * 낱장이 열리면 사라지고 다시 나오지 않는다. 서버 렌더와 어긋나지 않게 마운트 뒤에 붙인다. 저장소를 못 읽으면 점을 보이지 않는다.
 * 낱장(Sheet)은 건드리지 않는다 — 여는 쪽에서 그 dialog의 open 속성을 지켜본다(버튼으로 열든 주소 ?saju=open으로 열든 잡힌다).
 */
export function SajuNewDot({ sheetId }: { sheetId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) !== null;
    } catch {
      /* 저장소를 못 읽으면 점 없이 */
    }
    if (seen) return;
    const dialog = document.getElementById(sheetId);
    const mark = () => {
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* 못 써도 이번에는 사라진다 */
      }
      setShow(false);
    };
    if (dialog?.hasAttribute("open")) return mark();
    setShow(true);
    if (!dialog) return;
    const watch = new MutationObserver(() => {
      if (dialog.hasAttribute("open")) {
        mark();
        watch.disconnect();
      }
    });
    watch.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, [sheetId]);

  if (!show) return null;
  return (
    <span className="saju-line__new">
      <span className="sr-only">새로 생겼어요</span>
    </span>
  );
}
