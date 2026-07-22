import OpenAI from "openai";
import { chunkText } from "@/lib/rag";
import { getSupabaseServiceClient } from "@/lib/supabase/admin";

export type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  charCount: number;
  chunkCount: number;
  status: "pending" | "ready" | "error";
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MatchedChunk = {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
};

function mapDoc(row: Record<string, unknown>): KnowledgeDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content ?? ""),
    charCount: Number(row.char_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    status: (row.status as KnowledgeDocument["status"]) ?? "pending",
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 필요합니다.");
  }
  const client = new OpenAI({ apiKey });
  const BATCH = 100;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const resp = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    vectors.push(...resp.data.map((d) => d.embedding));
  }
  return vectors;
}

export async function listKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, content, char_count, chunk_count, status, created_by, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapDoc(row as Record<string, unknown>));
}

export async function getKnowledgeDocument(
  id: string
): Promise<KnowledgeDocument | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, content, char_count, chunk_count, status, created_by, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDoc(data as Record<string, unknown>) : null;
}

async function replaceChunks(
  documentId: string,
  content: string
): Promise<number> {
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error("텍스트가 너무 짧아 청크를 만들 수 없습니다.");
  }
  const vectors = await embedTexts(chunks);
  const supabase = getSupabaseServiceClient();

  const { error: delError } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);
  if (delError) throw new Error(delError.message);

  // HNSW 인덱스 갱신 때문에 한 번에 많이 넣으면 statement timeout이 난다.
  // 작은 배치로 나눠 삽입한다.
  const INSERT_BATCH = 10;
  for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
    const slice = chunks.slice(i, i + INSERT_BATCH);
    const rows = slice.map((chunk, offset) => {
      const index = i + offset;
      return {
        document_id: documentId,
        chunk_index: index,
        content: chunk,
        embedding: vectors[index],
      };
    });
    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  return chunks.length;
}

export async function createKnowledgeDocument(input: {
  title: string;
  content: string;
  createdBy: string;
}): Promise<KnowledgeDocument> {
  const title = input.title.trim() || "무제 이론 문서";
  const content = input.content.trim();
  if (!content) throw new Error("텍스트가 비어 있습니다.");

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      title,
      content,
      char_count: content.length,
      chunk_count: 0,
      status: "pending",
      created_by: input.createdBy,
    })
    .select(
      "id, title, content, char_count, chunk_count, status, created_by, created_at, updated_at"
    )
    .single();
  if (error) throw new Error(error.message);

  const doc = mapDoc(data as Record<string, unknown>);
  try {
    const chunkCount = await replaceChunks(doc.id, content);
    const { data: updated, error: updError } = await supabase
      .from("knowledge_documents")
      .update({
        chunk_count: chunkCount,
        char_count: content.length,
        status: "ready",
      })
      .eq("id", doc.id)
      .select(
        "id, title, content, char_count, chunk_count, status, created_by, created_at, updated_at"
      )
      .single();
    if (updError) throw new Error(updError.message);
    return mapDoc(updated as Record<string, unknown>);
  } catch (err) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "error" })
      .eq("id", doc.id);
    throw err;
  }
}

export async function reindexKnowledgeDocument(
  id: string
): Promise<KnowledgeDocument> {
  const doc = await getKnowledgeDocument(id);
  if (!doc) throw new Error("문서를 찾을 수 없습니다.");

  const supabase = getSupabaseServiceClient();
  await supabase
    .from("knowledge_documents")
    .update({ status: "pending" })
    .eq("id", id);

  try {
    const chunkCount = await replaceChunks(id, doc.content);
    const { data, error } = await supabase
      .from("knowledge_documents")
      .update({
        chunk_count: chunkCount,
        char_count: doc.content.length,
        status: "ready",
      })
      .eq("id", id)
      .select(
        "id, title, content, char_count, chunk_count, status, created_by, created_at, updated_at"
      )
      .single();
    if (error) throw new Error(error.message);
    return mapDoc(data as Record<string, unknown>);
  } catch (err) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "error" })
      .eq("id", id);
    throw err;
  }
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function matchKnowledgeChunks(
  queryText: string,
  matchCount = 5
): Promise<MatchedChunk[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];

  const [vector] = await embedTexts([trimmed]);
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: vector,
    match_count: matchCount,
  });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    documentId: String(row.document_id),
    content: String(row.content),
    chunkIndex: Number(row.chunk_index ?? 0),
    similarity: Number(row.similarity ?? 0),
  }));
}

export async function countReadyDocuments(): Promise<number> {
  const supabase = getSupabaseServiceClient();
  const { count, error } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
