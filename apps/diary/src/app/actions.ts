"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import {
  deleteAllUserRows,
  deleteEntry,
  deleteFortuneVote,
  deleteFortunesAsAdmin,
  ensureUserRow,
  getSajuProfile,
  markLinkPrompted,
  saveEntry,
  saveFortuneVote,
  saveName,
  saveNotificationSettings,
  saveSajuProfile,
} from "@/lib/db";
import { isAllowedRemindHour } from "@/lib/remind";
import { validateEntry, validateEntryDate } from "@/lib/entry";
import { dayGanji } from "@/lib/ganji";
import { COMPUTE_ERROR, computeProfile, validateName, validateProfile, type ProfileField } from "@/lib/profile";

export interface FormState {
  error: string | null;
  /** 생년월일 폼: 어느 입력 묶음에서 걸렸는지 (B3). 없으면 폼 아래 한 줄로만 보인다 */
  field?: ProfileField;
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
  revalidatePath("/write");
  redirect(`/?saved=${checked.value.entryDate}`);
}

/**
 * 그 날짜의 내 기록 지우기 (쓰기 화면 고치기 모드 "지우기"). 날짜 규칙은 저장과 같다(validateEntryDate).
 * 지운 뒤 /me로 — 지운 날짜의 쓰기 화면에 머물면 빈 폼이 "저장 전"처럼 보여 헷갈린다.
 */
export async function deleteEntryAction(form: FormData): Promise<void> {
  const checked = validateEntryDate(form.get("date"));
  if (!checked.ok) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    await deleteEntry(supabase, user.id, checked.value);
  } catch (e) {
    console.error("기록 지우기 실패", e);
    return;
  }
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/write");
  redirect("/me");
}

/** 생년월일 저장. 운세는 기다리지 않고 바로 돌아간다 — 오늘 화면의 Suspense가 맡는다 */
export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = Object.fromEntries(form.entries());
  const { supabase, user } = await getUser();
  if (!user) return { error: NOT_READY };

  // 익명 사용자는 이름을 묻지 않는다 → "손님"
  const typedName = typeof raw.name === "string" ? raw.name.trim() : "";
  const checked = validateProfile({ ...raw, name: typedName || "손님" });
  if (!checked.ok) return { error: checked.error, field: checked.field };

  const computed = computeProfile(checked.value);
  if (!computed.ok) {
    // 엔진 문구는 그대로 내보내지 않는다 (B3). validateProfile이 먼저 거르므로 여기 오는 일은 드물다
    console.error("사주 계산 실패", computed.error);
    return { error: COMPUTE_ERROR, field: "date" };
  }

  // 처음 만드는 프로필인지 — 그때만 /welcome(내 카드 공개, v3.3). 고치기는 next로 돌아간다
  let isFirst = false;
  try {
    isFirst = (await getSajuProfile(supabase, user.id)) === null;
    await saveSajuProfile(supabase, user.id, checked.value, computed.value);
  } catch (e) {
    console.error(e);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  revalidatePath("/", "layout");
  redirect(isFirst ? "/welcome" : safeNext(form.get("next"), "/"));
}

/** 설정 "이름" 저장 (B4). 1~40자. night_saju_profiles.name과 night_profiles.display_name을 같이 바꾼다 */
export async function saveNameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const checked = validateName(form.get("name"));
  if (!checked.ok) return { error: checked.error, field: "name" };
  const { supabase, user } = await getUser();
  if (!user) return { error: NOT_READY };
  try {
    await saveName(supabase, user.id, checked.value);
  } catch (e) {
    console.error(e);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * 익명 사용자의 "기록 모두 지우기" (B9) — 진짜 삭제. Google 사용자에게는 이 버튼이 없고(로그아웃만), 와도 아무것도 하지 않는다.
 * 1) 사용자 클라이언트로 본인 행 삭제(RLS) 2) 운세 캐시는 admin으로 user_id 조건 삭제 3) auth.admin.deleteUser로 계정 삭제
 * 4) 이 기기의 세션 쿠키를 지우고(local — 계정이 이미 없어 서버 로그아웃은 의미 없다) 새 익명 세션 → /.
 * 1·2·3이 실패하면 세션은 끊지 않고 설정으로 돌아간다 (기록이 서버에 남은 채 세션만 끊기는 일이 없게).
 */
export async function deleteAllAction(): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) return;
  if (!user.is_anonymous) return;
  const admin = adminClient();
  try {
    await deleteAllUserRows(supabase, user.id);
    await deleteFortunesAsAdmin(admin, user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`계정 지우기: ${error.message}`);
  } catch (e) {
    console.error("기록 모두 지우기 실패", e);
    redirect("/settings?error=delete");
  }
  const { error: outError } = await supabase.auth.signOut({ scope: "local" });
  if (outError) console.error("세션 지우기 실패", outError);
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("지운 뒤 익명 시작 실패", error ?? new Error("사용자 없음"));
  } else {
    try {
      await ensureUserRow(supabase, data.user.id, "손님");
    } catch (e) {
      console.error(e);
    }
  }
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * 로그아웃. 중간 화면 없이 액션 안에서 끝낸다. (익명 "기록 모두 지우기"는 deleteAllAction — B9)
 * 끊은 자리에서 바로 새 익명 세션을 만들어 쿠키에 심는다 — 서버 액션의 redirect는 소프트 내비게이션이라
 * 이미 마운트된 AnonBoot가 다시 돌지 않고, 돌아간 화면이 "준비하고 있어요"에 멈춰 있던 버그(2026-10-07).
 * 새 익명 세션 만들기가 실패하면 세션 없이 돌아가고, AnonBoot(경로 변경 감지)나 "다시 시도"가 이어받는다.
 */
export async function signOutAction(): Promise<void> {
  const { supabase } = await getUser();
  const { error: outError } = await supabase.auth.signOut();
  if (outError) console.error("로그아웃 실패", outError);
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("로그아웃 뒤 익명 시작 실패", error ?? new Error("사용자 없음"));
  } else {
    try {
      await ensureUserRow(supabase, data.user.id, "손님");
    } catch (e) {
      console.error(e);
    }
  }
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

/** 운세 투표. vote 1·-1은 저장(바꾸기), "0"은 취소 — 눌린 쪽을 다시 누르면 그 날짜 행을 지운다 */
export async function fortuneVoteAction(form: FormData): Promise<void> {
  const date = String(form.get("date") ?? "");
  const vote = Number(form.get("vote"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (vote !== 1 && vote !== -1 && vote !== 0)) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  try {
    if (vote === 0) await deleteFortuneVote(supabase, user.id, date);
    else await saveFortuneVote(supabase, user.id, date, vote);
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
