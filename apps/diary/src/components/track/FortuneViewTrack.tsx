"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * 운세 카드(details)가 보인 순간 fortune_view 한 번. 처음부터 펼쳐져 있으면 how=auto, 접혀 있다가 누르면 how=open.
 * 카드 안에 두면 가장 가까운 <details>를 찾아 toggle을 듣는다. 글 내용은 보내지 않는다 — 밴드(좋음·무난·주의)만.
 */
export function FortuneViewTrack({ band }: { band: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const details = ref.current?.closest("details");
    if (!details) return;
    let fired = false;
    const fire = (how: "auto" | "open") => {
      if (fired) return;
      fired = true;
      track("fortune_view", { kind: "today", band, how });
    };
    if (details.open) fire("auto");
    const onToggle = () => {
      if (details.open) fire("open");
    };
    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, [band]);
  return <span ref={ref} hidden />;
}
