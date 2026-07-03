import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const KNOWLEDGE_PATH = path.join(DATA_DIR, "knowledge.txt");
const EMBEDDINGS_PATH = path.join(DATA_DIR, "embeddings.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 텍스트를 일정 크기 청크로 분할 (overlap으로 문맥 연결 유지)
export function chunkText(text: string, size = 400, overlap = 80): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 20) chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
}

// 두 벡터 간 코사인 유사도 계산 (0~1, 1에 가까울수록 유사)
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

// 원본 텍스트 저장
export function saveKnowledge(text: string): void {
  ensureDataDir();
  writeFileSync(KNOWLEDGE_PATH, text, "utf-8");
}

// 원본 텍스트 불러오기
export function loadKnowledge(): string | null {
  if (!existsSync(KNOWLEDGE_PATH)) return null;
  return readFileSync(KNOWLEDGE_PATH, "utf-8");
}

export type EmbeddingChunk = {
  chunk: string;
  vector: number[];
};

// 임베딩(벡터) 저장
export function saveEmbeddings(embeddings: EmbeddingChunk[]): void {
  ensureDataDir();
  writeFileSync(EMBEDDINGS_PATH, JSON.stringify(embeddings), "utf-8");
}

// 임베딩 불러오기
export function loadEmbeddings(): EmbeddingChunk[] | null {
  if (!existsSync(EMBEDDINGS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(EMBEDDINGS_PATH, "utf-8")) as EmbeddingChunk[];
  } catch {
    return null;
  }
}

// 임베딩 존재 여부 확인
export function hasEmbeddings(): boolean {
  return existsSync(EMBEDDINGS_PATH);
}

// 질문 벡터와 가장 유사한 청크 topK개 반환
export function findTopChunks(
  queryVector: number[],
  embeddings: EmbeddingChunk[],
  topK = 5
): string[] {
  return embeddings
    .map((item) => ({ chunk: item.chunk, score: cosineSimilarity(queryVector, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.chunk);
}
