"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { saveEntry, saveFortuneVote, saveNotificationSettings, saveSajuProfile } from "@/lib/db";
import { isAllowedRemindHour } from "@/lib/remind";
import { clearGuestProfile, writeGuestProfile } from "@/lib/guest";
import { validateEntry } from "@/lib/entry";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, validateProfile } from "@/lib/profile";

export interface FormState {
  error: string | null;
}

/** 로그인 뒤 돌아갈 곳. 외부 주소로 튀지 않게 앱 안 경로만 허용한다. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const s = typeof value === "string" ? value : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function saveEntryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateEntry({
    entryDate: form.get("entryDate"),
    happiness: form.get("happiness"),
    moods: form.getAll("moods"),
    note: form.get("note"),
  });
  if (!checked.ok) return { error: checked.error };

  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/write")}`);

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

export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateProfile(Object.fromEntries(form.entries()));
  if (!checked.ok) return { error: checked.error };

  const computed = computeProfile(checked.value);
  if (!computed.ok) return { error: computed.error };

  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/onboarding");

  try {
    await saveSajuProfile(supabase, user.id, checked.value, computed.value);
  } catch (e) {
    console.error(e);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next"), "/"));
}

export async function signOutAction(): Promise<void> {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function guestProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateProfile({ ...Object.fromEntries(form.entries()), name: "손님" });
  if (!checked.ok) return { error: checked.error };
  const computed = computeProfile(checked.value);
  if (!computed.ok) return { error: computed.error };
  const { name: _name, ...guest } = checked.value;
  void _name;
  await writeGuestProfile(guest);
  revalidatePath("/");
  redirect("/");
}

export async function clearGuestAction(): Promise<void> {
  await clearGuestProfile();
  revalidatePath("/");
  redirect("/");
}

export async function fortuneVoteAction(form: FormData): Promise<void> {
  const date = String(form.get("date") ?? "");
  const vote = Number(form.get("vote"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (vote !== 1 && vote !== -1)) return;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/")}`);
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
  if (!user) return { ok: false, error: "로그인이 필요해요." };
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
  revalidatePath("/me");
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
  revalidatePath("/me");
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
  revalidatePath("/me");
}
