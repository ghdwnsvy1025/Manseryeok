// 비로그인 사용자의 생년월일. 쿠키에만 두고 서버에 저장하지 않는다.
// 운세 캐시 키는 생년월일시의 해시라 같은 사주면 기기가 달라도 캐시를 나눠 쓴다.
import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { ProfileInput } from "./profile";

export const GUEST_COOKIE = "night_guest";
const MAX_AGE = 60 * 60 * 24 * 180; // 180일

export type GuestProfile = Omit<ProfileInput, "name">;

export async function readGuestProfile(): Promise<GuestProfile | null> {
  const raw = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as GuestProfile;
    if (typeof p.birthYear !== "number" || typeof p.birthMonth !== "number" || typeof p.birthDay !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

export async function writeGuestProfile(p: GuestProfile): Promise<void> {
  (await cookies()).set(GUEST_COOKIE, JSON.stringify(p), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearGuestProfile(): Promise<void> {
  (await cookies()).delete(GUEST_COOKIE);
}

/** 같은 사주 = 같은 키. 이름은 넣지 않는다 */
export function guestKeyOf(p: GuestProfile): string {
  const s = [p.birthYear, p.birthMonth, p.birthDay, p.birthHour ?? "x", p.birthMinute ?? "x", p.calendar, p.isLeapMonth ? 1 : 0, p.gender, p.city].join("-");
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}
