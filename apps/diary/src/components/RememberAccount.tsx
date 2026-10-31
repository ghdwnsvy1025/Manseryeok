"use client";

import { useEffect } from "react";
import { rememberAccount } from "@/lib/accountMemory";

/** 생년월일이 있는 화면(오늘)에서 "이 기기에서 쓰던 계정"을 적어 둔다. 그리는 것은 없다 (ANON_START.md 8절) */
export function RememberAccount({ userId, anonymous }: { userId: string; anonymous: boolean }) {
  useEffect(() => {
    rememberAccount(userId, anonymous);
  }, [userId, anonymous]);
  return null;
}
