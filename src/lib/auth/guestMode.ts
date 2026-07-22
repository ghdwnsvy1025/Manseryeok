const GUEST_MODE_KEY = "manseryeok_guest_mode";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_MODE_KEY) === "1";
}

export function enableGuestMode(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_MODE_KEY, "1");
}

export function disableGuestMode(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_MODE_KEY);
}
