export const BETA_FEEDBACK_CATEGORIES = [
  "bug",
  "awkward_copy",
  "idea",
  "other",
] as const;

export type BetaFeedbackCategory = (typeof BETA_FEEDBACK_CATEGORIES)[number];

export const BETA_FEEDBACK_CATEGORY_LABELS: Record<
  BetaFeedbackCategory,
  string
> = {
  bug: "버그",
  awkward_copy: "어색한 문장",
  idea: "제안",
  other: "기타",
};

export const BETA_FEEDBACK_MAX_LEN = 500;

export type BetaFeedbackInput = {
  category: string;
  message: string;
  path?: string;
};

export function validateBetaFeedbackInput(
  input: BetaFeedbackInput
):
  | {
      ok: true;
      category: BetaFeedbackCategory;
      message: string;
      path: string;
    }
  | { ok: false; error: string } {
  const category = input.category?.trim() as BetaFeedbackCategory;
  if (!BETA_FEEDBACK_CATEGORIES.includes(category)) {
    return { ok: false, error: "유형을 선택해 주세요." };
  }

  const message = (input.message ?? "").trim().replace(/\s+/g, " ");
  if (!message) {
    return { ok: false, error: "내용을 적어 주세요." };
  }
  if (message.length > BETA_FEEDBACK_MAX_LEN) {
    return {
      ok: false,
      error: `내용은 ${BETA_FEEDBACK_MAX_LEN}자까지 적을 수 있어요.`,
    };
  }

  let path = (input.path ?? "/").trim() || "/";
  if (!path.startsWith("/") || path.startsWith("//")) {
    path = "/";
  }
  if (path.length > 200) {
    path = path.slice(0, 200);
  }

  return { ok: true, category, message, path };
}
