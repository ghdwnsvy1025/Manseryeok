import { getSupabaseServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIpFromRequest } from "@/lib/api/rateLimit";
import { SAFE_RIGHTS, SAFE_VERIFICATION } from "@/lib/journal/quote/types";
import type { LoadingPhrase } from "@/lib/ui/loadingPhrases";

export const runtime = "nodejs";

/**
 * 로딩용 짧은 명언 샘플 — 인증 불필요, IP 한도.
 */
export async function GET(req: Request) {
  const limited = checkRateLimit({
    key: `loading-phrases:${clientIpFromRequest(req)}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  try {
    const sb = getSupabaseServiceClient();
    const { data, error } = await sb
      .from("quote_library")
      .select("quote_text_ko")
      .eq("active", true)
      .in("rights_status", SAFE_RIGHTS)
      .in("verification_status", SAFE_VERIFICATION)
      .limit(80);

    if (error) {
      return Response.json({ phrases: [] as LoadingPhrase[] });
    }

    const phrases: LoadingPhrase[] = (data ?? [])
      .map((row) => String(row.quote_text_ko ?? "").trim())
      .filter((t) => t.length >= 12 && t.length <= 90)
      .slice(0, 40)
      .map((line) => ({ kind: "quote" as const, line }));

    // 매번 다른 순서로 보이도록 가볍게 섞음
    for (let i = phrases.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = phrases[i]!;
      phrases[i] = phrases[j]!;
      phrases[j] = tmp;
    }

    return Response.json({ phrases });
  } catch {
    return Response.json({ phrases: [] as LoadingPhrase[] });
  }
}
