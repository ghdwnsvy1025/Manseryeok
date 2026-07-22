import type {
  NarrativeFacts,
  NarrativeRequest,
  NarrativeSurface,
} from "./schema";

export async function requestGroundedWording(input: {
  surface: NarrativeSurface;
  facts: NarrativeFacts;
}): Promise<{
  wording: Record<string, string>;
  usedRag: boolean;
  chunkCount: number;
} | null> {
  try {
    const body: NarrativeRequest = {
      surface: input.surface,
      facts: input.facts,
    };
    const res = await fetch("/api/narrative/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      wording?: Record<string, string>;
      usedRag?: boolean;
      chunkCount?: number;
    };
    if (!data.wording) return null;
    return {
      wording: data.wording,
      usedRag: Boolean(data.usedRag),
      chunkCount: data.chunkCount ?? 0,
    };
  } catch {
    return null;
  }
}
