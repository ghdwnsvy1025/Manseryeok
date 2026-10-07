// 첫 방문 대기 (B2): 5초 전엔 뼈대, 5초가 지나면 "준비하고 있어요 · 다시 시도"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BOOT_WAIT_MS, createBootWait } from "@/lib/bootWait";

describe("createBootWait", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("기본 대기는 5초", () => {
    expect(BOOT_WAIT_MS).toBe(5000);
  });

  test("서버 스냅샷은 늘 false(뼈대), 구독 뒤 5초가 지나야 true(안내 카드)", () => {
    const w = createBootWait();
    const onChange = vi.fn();
    expect(w.getServerSnapshot()).toBe(false);
    expect(w.getSnapshot()).toBe(false);
    w.subscribe(onChange);
    vi.advanceTimersByTime(4999);
    expect(w.getSnapshot()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.getSnapshot()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test("구독하기 전에는 재지 않고, 마지막 구독이 풀리면 타이머를 치운다 (refresh로 사라졌을 때)", () => {
    const w = createBootWait(5000);
    vi.advanceTimersByTime(10000);
    expect(w.getSnapshot()).toBe(false);
    const off = w.subscribe(() => {});
    off();
    vi.advanceTimersByTime(10000);
    expect(w.getSnapshot()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
