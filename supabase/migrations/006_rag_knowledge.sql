-- Phase: RAG knowledge documents + pgvector for persistent saju theory

create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  status text not null default 'pending',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_documents_status_check'
  ) then
    alter table public.knowledge_documents
      add constraint knowledge_documents_status_check
      check (status in ('pending', 'ready', 'error'));
  end if;
end $$;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_document_id_idx
  on public.knowledge_chunks (document_id);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists knowledge_documents_updated_at_idx
  on public.knowledge_documents (updated_at desc);

drop trigger if exists knowledge_documents_set_updated_at on public.knowledge_documents;
create trigger knowledge_documents_set_updated_at
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

-- Similarity search RPC (service role / server only)
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'ready'
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

-- Default deny for anon/authenticated; server uses service role
drop policy if exists "No direct access to knowledge documents" on public.knowledge_documents;
drop policy if exists "No direct access to knowledge chunks" on public.knowledge_chunks;

-- Explicit deny policies are optional with RLS enabled and no grants;
-- revoke table privileges from anon/authenticated for clarity
revoke all on public.knowledge_documents from anon, authenticated;
revoke all on public.knowledge_chunks from anon, authenticated;
revoke all on function public.match_knowledge_chunks(vector, integer) from anon, authenticated;
grant execute on function public.match_knowledge_chunks(vector, integer) to service_role;
grant all on public.knowledge_documents to service_role;
grant all on public.knowledge_chunks to service_role;
