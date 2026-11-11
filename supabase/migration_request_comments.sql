-- Gestão de Demandas DelRio
-- Comentários privados por solicitação, com acesso controlado por RLS.
-- Execute uma única vez no SQL Editor do Supabase após publicar esta migração.

create table if not exists public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists request_comments_request_created_idx
  on public.request_comments(request_id, created_at);

alter table public.request_comments enable row level security;

revoke all on public.request_comments from anon, authenticated;
grant select, insert on public.request_comments to authenticated;

drop policy if exists request_comments_read_participants on public.request_comments;
create policy request_comments_read_participants
  on public.request_comments
  for select
  to authenticated
  using (
    public.can_access_request(request_id)
    and exists (
      select 1
      from public.requests r
      where r.id = request_comments.request_id
        and r.deleted_at is null
    )
  );

drop policy if exists request_comments_insert_participants on public.request_comments;
create policy request_comments_insert_participants
  on public.request_comments
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and char_length(trim(body)) between 1 and 5000
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.active = true
    )
    and public.can_access_request(request_id)
    and exists (
      select 1
      from public.requests r
      where r.id = request_comments.request_id
        and r.deleted_at is null
    )
  );

comment on table public.request_comments is
  'Conversa entre participantes autorizados, vinculada individualmente a cada solicitação.';
comment on column public.request_comments.body is
  'Conteúdo da mensagem; mensagens são preservadas e não podem ser editadas ou excluídas pelo cliente.';

-- Habilita atualização em tempo real para a conversa, sem duplicar a publicação.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'request_comments'
  ) then
    alter publication supabase_realtime add table public.request_comments;
  end if;
end;
$$;
