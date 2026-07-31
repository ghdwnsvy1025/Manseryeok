/** Grow a textarea with content; clamp between minPx and maxPx. */
export function autosizeTextarea(
  el: HTMLTextAreaElement | null,
  opts?: { minPx?: number; maxPx?: number }
): void {
  if (!el) return;
  const minPx = opts?.minPx ?? 144;
  const maxPx = opts?.maxPx ?? 420;
  el.style.height = "auto";
  const next = Math.min(Math.max(el.scrollHeight, minPx), maxPx);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > maxPx ? "auto" : "hidden";
}
