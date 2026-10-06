// 운세 캐시 쓰기. night_fortunes는 (user_id, fortune_date) · (guest_key, fortune_date)에 부분 유니크 인덱스가 있다.
// 부분 인덱스라 PostgREST upsert(onConflict)를 못 쓰므로, insert가 중복 키(23505)로 실패하면 그 행을 찾아 update한다.
// 같은 게스트·같은 날 요청이 동시에 둘 들어오면(첫 화면이 두 번 렌더되는 경우) 둘 다 insert로 가서 났던 "운세 캐시 저장 실패 … duplicate key"를 막는다.
import type { FortuneOwner } from "./index";

export interface FortuneCacheRow {
  user_id: string | null;
  guest_key: string | null;
  fortune_date: string;
  profile_fingerprint: string;
  score: number;
  content: unknown;
  model: string | null;
}

/** supabase-js 체인에서 쓰는 부분만. 테스트에서 가짜를 끼운다 */
export interface FortuneCacheDb {
  from(table: "night_fortunes"): {
    insert(row: FortuneCacheRow): PromiseLike<{ error: { code?: string; message: string } | null }>;
    update(row: FortuneCacheRow): { eq(col: string, val: string): PromiseLike<{ error: { message: string } | null }> };
    select(cols: string): {
      eq(col: string, val: string): {
        eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: { id: string } | null; error: { message: string } | null }> };
      };
    };
  };
}

export const ownerFilter = (owner: FortuneOwner): { col: "user_id" | "guest_key"; val: string } =>
  owner.userId ? { col: "user_id", val: owner.userId } : { col: "guest_key", val: owner.guestKey! };

export const DUPLICATE_KEY = "23505";

/**
 * cachedId가 있으면(지문만 달라진 기존 행) update, 없으면 insert.
 * insert가 중복 키면 다른 요청이 먼저 넣은 것이므로 그 행을 찾아 update한다. 돌려주는 값은 쓰기 경로.
 */
export async function saveFortuneCache(
  sb: FortuneCacheDb,
  owner: FortuneOwner,
  row: FortuneCacheRow,
  cachedId: string | null,
): Promise<{ path: "update" | "insert" | "insert→update"; error: string | null }> {
  const t = () => sb.from("night_fortunes");
  if (cachedId) {
    const { error } = await t().update(row).eq("id", cachedId);
    return { path: "update", error: error?.message ?? null };
  }
  const ins = await t().insert(row);
  if (!ins.error) return { path: "insert", error: null };
  if (ins.error.code !== DUPLICATE_KEY && !/duplicate key/i.test(ins.error.message)) return { path: "insert", error: ins.error.message };

  const { col, val } = ownerFilter(owner);
  const { data, error: selErr } = await t().select("id").eq(col, val).eq("fortune_date", row.fortune_date).maybeSingle();
  if (selErr || !data) return { path: "insert→update", error: selErr?.message ?? "중복 키인데 기존 행을 못 찾음" };
  const { error } = await t().update(row).eq("id", data.id);
  return { path: "insert→update", error: error?.message ?? null };
}
