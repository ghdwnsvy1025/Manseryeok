// 운영 DB에서 앱 주인의 사주 프로필(생년월일시·기둥 스냅숏)만 읽어 JSON으로 남긴다. 쓰기 없음. 비밀값은 출력하지 않는다.
// 실행 (apps/diary): BASIS_PROFILE_OUT=<파일> npx vitest run --config vitest.scripts.config.ts scripts/fortune-basis-profile.migrate.ts
import { readFileSync, writeFileSync } from "node:fs";
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";
import { birthProfileOf } from "@/lib/db";

test("basis profile: 앱 주인 프로필 읽기", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.id.startsWith("1aa4bbd3"))!;
  const { data: prof, error } = await sb.from("night_saju_profiles").select("*").eq("user_id", me.id).single();
  if (error || !prof) throw new Error(error?.message ?? "프로필 없음");
  const { count } = await sb.from("night_entries").select("id", { count: "exact", head: true }).eq("user_id", me.id);
  const out = { pillars: prof.pillars, profile: birthProfileOf(prof), engine_version: prof.engine_version, entries: count ?? 0 };
  writeFileSync(process.env.BASIS_PROFILE_OUT ?? "basis-profile.json", JSON.stringify(out, null, 1), "utf8");
  console.log(JSON.stringify({ pillars: out.pillars, profile: out.profile, entries: out.entries }, null, 1));
});
