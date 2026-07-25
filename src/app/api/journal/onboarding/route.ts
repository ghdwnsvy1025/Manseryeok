import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_VERSION,
  validateOnboardingAnswers,
  type OnboardingAnswers,
} from "@/lib/journal/onboarding/questions";
import {
  deriveOnboardingProfile,
  EMPTY_ONBOARDING_PROFILE,
} from "@/lib/journal/onboarding/profile";

export const runtime = "nodejs";

const TABLE = "journal_onboarding_profiles";

/** GET — 문항 정의 + (로그인 시) 저장된 답변·prior */
export async function GET() {
  const sb = getSupabaseServerClient();
  if (!sb) {
    return Response.json({
      version: ONBOARDING_VERSION,
      questions: ONBOARDING_QUESTIONS,
      answers: {},
      profile: EMPTY_ONBOARDING_PROFILE,
    });
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({
      version: ONBOARDING_VERSION,
      questions: ONBOARDING_QUESTIONS,
      answers: {},
      profile: EMPTY_ONBOARDING_PROFILE,
    });
  }

  const { data } = await sb
    .from(TABLE)
    .select("answers, derived, completeness, completed, onboarding_version")
    .eq("user_id", user.id)
    .maybeSingle();

  const answers = (data?.answers ?? {}) as OnboardingAnswers;
  return Response.json({
    version: ONBOARDING_VERSION,
    questions: ONBOARDING_QUESTIONS,
    answers,
    profile: data?.derived ?? deriveOnboardingProfile(answers),
  });
}

/** POST — 답변 저장. body: { answers: { questionId: string[] } } */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const raw = (body as { answers?: unknown }).answers;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return Response.json({ error: "answers 객체가 필요합니다." }, { status: 400 });
  }

  const answers = raw as OnboardingAnswers;
  const check = validateOnboardingAnswers(answers);
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  const profile = deriveOnboardingProfile(answers);

  const sb = getSupabaseServerClient();
  if (!sb) {
    // 비로그인·오프라인: 검증과 환산만 돌려주고 클라이언트가 로컬 보관
    return Response.json({ ok: true, persisted: false, profile });
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ ok: true, persisted: false, profile });
  }

  const { error } = await sb.from(TABLE).upsert(
    {
      user_id: user.id,
      onboarding_version: ONBOARDING_VERSION,
      answers,
      derived: profile,
      completeness: profile.completeness,
      completed: profile.completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return Response.json(
      { ok: false, persisted: false, error: error.message, profile },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, persisted: true, profile });
}
