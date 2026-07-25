/**
 * 인증된 userId로 인사이트 스냅샷을 쓸 때 사용하는 클라이언트.
 * 쿠키 세션으로 신원을 확인한 뒤, service role이 있으면 RLS 우회로 영속화한다.
 * (질문/운세 스냅샷이 RLS·RETURNING 이슈로 조용히 누락되는 것을 방지)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

export function resolveInsightPersistClient(
  userClient: SupabaseClient
): SupabaseClient {
  if (!isServiceRoleConfigured()) return userClient;
  try {
    return getSupabaseServiceClient();
  } catch {
    return userClient;
  }
}
