-- Quote library embedding + admin write policies (additive)

alter table public.quote_library
  add column if not exists embedding vector(1536);

-- 소규모 라이브러리에서는 시퀀셜 스캔으로 충분.
-- 데이터가 충분히 쌓인 뒤 ivfflat/hnsw 인덱스를 추가하세요.

-- RPC: hybrid-ish semantic search over verified active quotes
create or replace function public.match_quote_library(
  query_embedding vector(1536),
  match_count int default 12
)
returns table (
  id uuid,
  quote_text_ko text,
  original_text text,
  author_name text,
  work_title text,
  publication_info text,
  source_url text,
  source_type text,
  translator text,
  language text,
  themes_json jsonb,
  emotional_tone_json jsonb,
  suitable_states_json jsonb,
  unsuitable_states_json jsonb,
  rights_status text,
  verification_status text,
  attribution_confidence double precision,
  active boolean,
  similarity double precision
)
language sql
stable
as $$
  select
    q.id,
    q.quote_text_ko,
    q.original_text,
    q.author_name,
    q.work_title,
    q.publication_info,
    q.source_url,
    q.source_type,
    q.translator,
    q.language,
    q.themes_json,
    q.emotional_tone_json,
    q.suitable_states_json,
    q.unsuitable_states_json,
    q.rights_status,
    q.verification_status,
    q.attribution_confidence,
    q.active,
    1 - (q.embedding <=> query_embedding) as similarity
  from public.quote_library q
  where q.active = true
    and q.embedding is not null
    and q.verification_status in (
      'primary_source_verified',
      'reputable_secondary_verified',
      'translation_verified'
    )
    and q.rights_status in (
      'public_domain',
      'licensed',
      'permission_granted',
      'internally_written'
    )
  order by q.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Admin writes: service role bypasses RLS; authenticated admin path uses service client.
-- Keep select policy from 015; allow authenticated insert/update for service tooling via service role only.
