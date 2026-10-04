import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { dayGanji } from "@/lib/ganji";
import { sendPush } from "@/lib/push";
import { pickDue, remindMessage, type RemindCandidate } from "@/lib/remind";
import { addDays, hourKST, todayKST } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Vercel Cron이 매시 정각(UTC 10~14시)에 부른다. CRON_SECRET이 맞아야 한다. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = adminClient();
  const today = todayKST();
  const hour = Number(request.nextUrl.searchParams.get("hour") ?? hourKST());

  const { data: settings, error } = await sb
    .from("night_notification_settings")
    .select("user_id, remind_at, web_push, enabled")
    .eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = (settings ?? []) as RemindCandidate[];
  const ids = candidates.map((c) => c.user_id);
  const wroteToday = new Set<string>();
  if (ids.length > 0) {
    const { data: entries } = await sb.from("night_entries").select("user_id").eq("entry_date", today).in("user_id", ids);
    for (const e of entries ?? []) wroteToday.add(e.user_id as string);
  }

  const due = pickDue(candidates, hour, wroteToday);
  const message = remindMessage(dayGanji(addDays(today, 1)).ko);
  const results = { sent: 0, gone: 0, failed: 0, unconfigured: 0 };
  for (const c of due) {
    const r = await sendPush(c.web_push, message);
    results[r] += 1;
    if (r === "gone") {
      await sb.from("night_notification_settings").update({ enabled: false, web_push: null }).eq("user_id", c.user_id);
    }
  }
  return NextResponse.json({ hour, candidates: candidates.length, due: due.length, ...results });
}
