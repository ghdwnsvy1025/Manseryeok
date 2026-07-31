import { NextRequest } from "next/server";
import { requireAuthUser } from "@/lib/api/requireAuth";
import { checkLlmRateLimit } from "@/lib/api/rateLimit";
import type { SajuProfile } from "@/lib/diary/types";
import {
  buildNatalReadingMaterialsFromProfile,
  natalReadingInputHash,
} from "@/lib/saju/reading/natalMaterials";
import { generateNatalReading } from "@/lib/saju/reading/generateNatalReading";
import {
  loadNatalReadingCache,
  persistNatalReading,
} from "@/lib/saju/reading/persist";

export const runtime = "nodejs";

type Body = {
  sajuProfile?: SajuProfile | null;
  sajuProfileId?: string;
  /** true면 LLM 생략 (폴백 골격만) */
  skipLlm?: boolean;
  /** true면 캐시 무시하고 재생성 */
  forceRefresh?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requireAuthUser();
  if (!auth.ok) return auth.response;
  const limited = checkLlmRateLimit(auth.user.id);
  if (!limited.ok) return limited.response;

  try {
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const profile = body.sajuProfile ?? null;
    if (!profile?.birthDate || !profile.id) {
      return Response.json(
        { error: "sajuProfile(id, birthDate)이 필요합니다." },
        { status: 400 }
      );
    }

    const profileId = body.sajuProfileId || profile.id;
    const inputHash = natalReadingInputHash(profile);
    const skipLlm = Boolean(body.skipLlm);
    const forceRefresh = Boolean(body.forceRefresh);

    if (!skipLlm && !forceRefresh) {
      const cached = await loadNatalReadingCache(
        auth.client,
        auth.user.id,
        profileId,
        inputHash
      );
      if (cached) {
        return Response.json({
          ...cached,
          cached: true,
          inputHash,
          sajuProfileId: profileId,
        });
      }
    }

    const materials = buildNatalReadingMaterialsFromProfile(profile);
    const reading = await generateNatalReading(materials, { skipLlm });

    if (!skipLlm && reading.openAi.kind === "used") {
      await persistNatalReading(auth.client, {
        userId: auth.user.id,
        sajuProfileId: profileId,
        inputHash,
        reading,
      });
    }

    return Response.json({
      ...reading,
      cached: false,
      inputHash,
      sajuProfileId: profileId,
      materialsSummary: {
        dayMaster: materials.dayMaster,
        dayPillar: materials.pillars.day.ganjiKo,
        currentDaeun: materials.daeun.current?.ganjiKo ?? null,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[natal-reading]", detail);
    return Response.json(
      { error: "원국 종합풀이 생성 중 오류가 났어요.", detail },
      { status: 500 }
    );
  }
}
