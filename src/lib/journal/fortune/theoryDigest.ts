/**
 * 운세용 고정 이론 요약 — 매 요청 필수 투입.
 * RAG(관리자 청크)는 보조.
 */
import {
  FORTUNE_THEORY_DIGEST,
  FORTUNE_THEORY_DIGEST_VERSION,
} from "./fortuneTheoryDigest.generated";

export {
  FORTUNE_THEORY_DIGEST,
  FORTUNE_THEORY_DIGEST_VERSION,
};

export function fortuneTheoryDigestAvailable(): boolean {
  return FORTUNE_THEORY_DIGEST.trim().length > 200;
}
