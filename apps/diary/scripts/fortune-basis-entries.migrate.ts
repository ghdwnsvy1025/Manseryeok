// 2026-11-17 기록이 든 운세 시안용: 운영 DB에서 앱 주인의 기록 중 운세에 쓰는 고른 값만 읽어 JSON으로 남긴다. 쓰기 없음.
// 메모(자유 글)는 읽지 않는다(기록 반영 설계 Q4). 비밀값은 출력하지 않는다. 결과 파일은 개인 기록이라 저장소에 넣지 않는다.
// 실행 (apps/diary): BASIS_ENTRIES_OUT=<파일> npx vitest run --config vitest.scripts.config.ts scripts/fortune-basis-entries.migrate.ts
import { readFileSync, writeFileSync } from "node:fs";
import { test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";

test("basis entries: 앱 주인 기록(고른 값만) 읽기", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.id.startsWith("1aa4bbd3"))!;
  const { data, error } = await sb.from("night_entries").select("entry_date, day_ganji_index, day_stem, day_branch, happiness, moods, states").eq("user_id", me.id).order("entry_date");
  if (error) throw new Error(error.message);
  writeFileSync(process.env.BASIS_ENTRIES_OUT ?? "basis-entries.json", JSON.stringify(data ?? [], null, 1), "utf8");
  const rows = data ?? [];
  console.log(`기록 ${rows.length}편 · 상태값 있는 편 ${rows.filter((r) => r.states).length} · 기분 있는 편 ${rows.filter((r) => (r.moods ?? []).length).length} · ${rows[0]?.entry_date ?? "-"} ~ ${rows.at(-1)?.entry_date ?? "-"}`);
});
