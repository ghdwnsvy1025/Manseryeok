import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateCheckInSave,
  type CoreStateUi,
  type DomainStateUi,
} from "@/lib/journal/checkin/validation";
import {
  CORE_STATE_CODES,
  type CoreStateCode,
} from "@/lib/journal/checkin/catalog";
import { MOOD_OPTIONS } from "@/lib/journal/types";

export const runtime = "nodejs";

/**
 * POST /api/journal/checkin
 * — 체크인 v2 서버 검증. 우회 저장 차단용 권위 경로.
 * body: { happiness, moods, tagCodes, core, domains }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const b = body as {
    happiness?: unknown;
    moods?: unknown;
    tagCodes?: unknown;
    core?: unknown;
    domains?: unknown;
  };

  if (!Array.isArray(b.moods) || !Array.isArray(b.tagCodes)) {
    return Response.json(
      { error: "moods와 tagCodes가 필요합니다." },
      { status: 400 }
    );
  }

  const moods = b.moods.filter((m): m is string => typeof m === "string");
  const tagCodes = b.tagCodes.filter((t): t is string => typeof t === "string");

  const coreRaw =
    b.core && typeof b.core === "object"
      ? (b.core as Record<string, CoreStateUi>)
      : {};
  const core = {} as Record<CoreStateCode, CoreStateUi>;
  for (const code of CORE_STATE_CODES) {
    const row = coreRaw[code];
    core[code] = {
      ordinal: row?.ordinal ?? null,
      isNotApplicable: Boolean(row?.isNotApplicable),
    };
  }

  const domains = Array.isArray(b.domains)
    ? (b.domains as DomainStateUi[])
    : [];

  const check = validateCheckInSave({
    happiness: b.happiness,
    moods,
    tagCodes,
    core,
    domains,
  });

  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  // 로그인 시 서버가 소유권을 확인할 수 있으면 확인 (저장은 클라 storage 유지)
  const sb = getSupabaseServerClient();
  let userId: string | null = null;
  if (sb) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    userId = user?.id ?? null;
  }

  return Response.json({
    ok: true,
    validated: true,
    userId,
    moodCatalogSize: MOOD_OPTIONS.length,
    maxMoods: 3,
  });
}
