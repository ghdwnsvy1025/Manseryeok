"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { ensureUserRow, markLinkPrompted, saveEntry, saveFortuneVote, saveNotificationSettings, saveSajuProfile } from "@/lib/db";
import { isAllowedRemindHour } from "@/lib/remind";
import { validateEntry } from "@/lib/entry";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, validateProfile } from "@/lib/profile";

export interface FormState {
  error: string | null;
}

/** 익명 세션이 아직 안 만들어졌을 때 (첫 요청 직후). AnonBoot가 곧 세션을 만들고 화면을 새로 그린다 */
const NOT_READY = "준비하고 있어요. 잠시 뒤 다시 눌러 주세요.";

/** 저장 뒤 돌아갈 곳. 외부 주소로 튀지 않게 앱 안 경로만 허용한다. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

/** AnonBoot가 익명 세션을 만든 직후 한 번: night_profiles 행을 만든다 (이름 "손님") */
export async function bootAnonAction(): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await ensureUserRow(supabase, user.id, user.is_anonymous ? "손님" : null);
  } catch (e) {
    console.error(e);
  }
}

export async function saveEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateEntry({
    entryDate: form.get("entryDate"),
    happiness: form.get("happiness"),
    moods: form.getAll("moods"),
    note: form.get("note"),
    // 오늘의 작은 약속 (톤 v3.2). 운세 캐시가 없던 날은 폼에 필드가 없다 → null
    promise: form.get("promise"),
    promiseText: form.get("promise_text"),
  });
  if (!checked.ok) return { error: checked.error };

  const { supabase, user } = await getUser();
  if (!user) return { error: NOT_READY };

  try {
    await saveEntry(supabase, user.id, checked.value, dayGanji(checked.value.entryDate));
  } catch (e) {
    console.error(e);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  revalidatePath("/");
  revalidatePath("/me");
  redirect(`/?saved=${checked.value.entryDate}`);
}

/** 생년월일 저장. 운세는 기다리지 않고 바로 돌아간다 — 오늘 화면의 Suspense가 맡는다 */
export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form.entries());
  const { supabase, user } = await getUser();
  if (!user) return { error: NOT_READY };

  // 익명 사용자는 이름을 묻지 않는다 → "손님"
  const typedName = typeof raw.name === "string" ? raw.name.trim() : "";
  const checked = validateProfile({ ...raw, name: typedName || "손님" });
  if (!checked.ok) return { error: checked.error };

  const computed = computeProfile(checked.value);
  if (!computed.ok) return { error: computed.error };

  try {
    await saveSajuProfile(supabase, user.id, checked.value, computed.value);
  } catch (e) {
    console.error(e);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next"), "/"));
}

/** 로그아웃(또는 익명 "기록 모두 지우기"). 중간 화면 없이 액션 안에서 끝낸다 */
export async function signOutAction(): Promise<void> {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** Google 연결 안내 카드를 보여 줬다고 기록 (한 번만 나오게) */
export async function markLinkPromptedAction(nextCount: number): Promise<void> {
  const n = Number.isInteger(nextCount) && nextCount > 0 && nextCount < 10 ? nextCount : 1;
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await markLinkPrompted(supabase, user.id, n);
  } catch (e) {
    console.error(e);
  }
}

export async function fortuneVoteAction(form: FormData): Promise<void> {
  const date = String(form.get("date") ?? "");
  const vote = Number(form.get("vote"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (vote !== 1 && vote !== -1)) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await saveFortuneVote(supabase, user.id, date, vote);
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/");
}

/** 브라우저가 만든 푸시 구독을 저장하고 알림을 켠다 */
export async function enablePushAction(subscriptionJson: string, remindHour: number): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: NOT_READY };
  let sub: unknown;
  try {
    sub = JSON.parse(subscriptionJson);
  } catch {
    return { ok: false, error: "구독 정보를 읽지 못했어요." };
  }
  if (!sub || typeof sub !== "object" || typeof (sub as { endpoint?: unknown }).endpoint !== "string") {
    return { ok: false, error: "구독 정보가 올바르지 않아요." };
  }
  const hour = isAllowedRemindHour(remindHour) ? remindHour : 21;
  try {
    await saveNotificationSettings(supabase, user.id, {
      enabled: true,
      web_push: sub,
      remind_at: `${String(hour).padStart(2, "0")}:00`,
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "저장하지 못했어요." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function disablePushAction(): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await saveNotificationSettings(supabase, user.id, { enabled: false, web_push: null });
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/settings");
}

export async function setRemindHourAction(form: FormData): Promise<void> {
  const hour = Number(form.get("hour"));
  if (!isAllowedRemindHour(hour)) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await saveNotificationSettings(supabase, user.id, { remind_at: `${String(hour).padStart(2, "0")}:00` });
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/settings");
}
