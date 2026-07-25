export type QuoteRightsStatus =
  | "public_domain"
  | "licensed"
  | "permission_granted"
  | "internally_written"
  | "review_required"
  | "prohibited";

export type QuoteVerificationStatus =
  | "primary_source_verified"
  | "reputable_secondary_verified"
  | "translation_verified"
  | "unverified"
  | "rejected";

export type QuoteLibraryItem = {
  id: string;
  quoteTextKo: string;
  originalText: string | null;
  authorName: string | null;
  workTitle: string | null;
  publicationInfo: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  translator: string | null;
  language: string;
  themes: string[];
  emotionalTone: string[];
  suitableStates: string[];
  unsuitableStates: string[];
  rightsStatus: QuoteRightsStatus;
  verificationStatus: QuoteVerificationStatus;
  attributionConfidence: number;
  active: boolean;
  similarity?: number;
};

export const SAFE_RIGHTS: QuoteRightsStatus[] = [
  "public_domain",
  "licensed",
  "permission_granted",
  "internally_written",
];

export const SAFE_VERIFICATION: QuoteVerificationStatus[] = [
  "primary_source_verified",
  "reputable_secondary_verified",
  "translation_verified",
];

export function isQuoteExposable(q: QuoteLibraryItem): boolean {
  return (
    q.active &&
    SAFE_RIGHTS.includes(q.rightsStatus) &&
    SAFE_VERIFICATION.includes(q.verificationStatus) &&
    q.attributionConfidence >= 0.6
  );
}
