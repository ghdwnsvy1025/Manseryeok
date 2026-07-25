/**
 * 운세·오늘의 문장 공통 안전 필터
 */
export const CONTENT_SAFETY_VERSION = "content-safety-v1.0.0";

const FORBIDDEN_FORTUNE: RegExp[] = [
  /반드시\s*좋은\s*일이\s*생긴다/,
  /돈이\s*들어온다/,
  /연인이\s*생긴다/,
  /헤어질\s*운/,
  /사고가\s*난다/,
  /병이\s*생긴다/,
  /직장을\s*잃는다/,
  /계약이\s*반드시\s*성공/,
  /오늘은\s*무조건\s*나쁘다/,
  /운명이\s*정해져/,
  /진단/,
  /치료\s*중단/,
  /투자하면\s*수익/,
  /대출/,
  /이별한다/,
  /배신당/,
];

const FORBIDDEN_SENTENCE: RegExp[] = [
  ...FORBIDDEN_FORTUNE,
  /힘내/,
  /긍정적으로\s*생각/,
  /모든\s*일은\s*잘될/,
  /시련은\s*성공/,
  /마음먹기에\s*따라/,
  /당신은\s*우울/,
  /파산/,
  /자해/,
  /죽어/,
];

const SAJU_TERMS: RegExp[] = [
  /십신/,
  /비겁/,
  /식상/,
  /재성/,
  /관성/,
  /인성/,
  /천간/,
  /지지/,
  /원국/,
  /대운/,
  /세운/,
];

const CELEBRITY_HINT: RegExp[] = [
  /—\s*\S{2,}/,
  /-\s*[가-힣A-Za-z]{2,}\s*$/,
  /『.+』/,
  /「.+」\s*[가-힣A-Za-z]{2,}/,
];

export type ContentSafetyResult = {
  ok: boolean;
  reasons: string[];
};

export function validateFortuneText(text: string): ContentSafetyResult {
  const reasons: string[] = [];
  for (const re of FORBIDDEN_FORTUNE) {
    if (re.test(text)) reasons.push(`forbidden_fortune:${re.source}`);
  }
  return { ok: reasons.length === 0, reasons };
}

export function validateTodaySentenceText(
  text: string,
  opts?: { maxLen?: number; minLen?: number }
): ContentSafetyResult {
  const reasons: string[] = [];
  const maxLen = opts?.maxLen ?? 100;
  const minLen = opts?.minLen ?? 8;
  const trimmed = text.trim();
  if (trimmed.length > maxLen) reasons.push("max_length");
  if (trimmed.length < minLen) reasons.push("min_length");
  for (const re of FORBIDDEN_SENTENCE) {
    if (re.test(trimmed)) reasons.push(`forbidden_sentence:${re.source}`);
  }
  for (const re of SAJU_TERMS) {
    if (re.test(trimmed)) reasons.push(`saju_term:${re.source}`);
  }
  for (const re of CELEBRITY_HINT) {
    if (re.test(trimmed)) reasons.push(`celebrity_attribution_hint:${re.source}`);
  }
  if (/^["“「『].+["”」』]$/.test(trimmed)) {
    reasons.push("looks_like_quote");
  }
  return { ok: reasons.length === 0, reasons };
}

export function scrubBannedPhrases(text: string): string {
  let out = text;
  for (const re of FORBIDDEN_SENTENCE) {
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}
