-- Gestão de Demandas DelRio
-- Controle individual de leitura das conversas por solicitação.
-- Execute uma única vez no SQL Editor do Supabase após publicar esta migração.

create table if not exists public.request_comment_reads (
  request_id uuid not null references public.requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (request_id, profile_id)
);

create index if not exists request_comment_reads_profile_idx
  on public.request_comment_reads(profile_id, request_id);

alter table public.request_comment_reads enable row level security;

revoke all on public.request_comment_reads from anon, authenticated;
grant select, insert, update on public.request_comment_reads to authenticated;

drop policy if exists request_comment_reads_select_own on public.request_comment_reads;
create policy request_comment_reads_select_own
  on public.request_comment_reads
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    and public.can_access_request(request_id)
  );

drop policy if exists request_comment_reads_insert_own on public.request_comment_reads;
create policy request_comment_reads_insert_own
  on public.request_comment_reads
  for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.can_access_request(request_id)
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.active = true
    )
  );

drop policy if exists request_comment_reads_update_own on public.request_comment_reads;
create policy request_comment_reads_update_own
  on public.request_comment_reads
  for update
  to authenticated
  using (
    profile_id = (select auth.uid())
    and public.can_access_request(request_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.can_access_request(request_id)
  );

comment on table public.request_comment_reads is
  'Última leitura individual de cada participante em cada conversa de solicitação.';
