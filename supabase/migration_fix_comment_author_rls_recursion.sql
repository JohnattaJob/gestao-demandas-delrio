-- Gestão de Demandas DelRio
-- Corrige recursão entre as políticas RLS de profiles e request_comments.
-- Execute uma única vez no SQL Editor do Supabase após atualizar a branch.

create or replace function public.can_view_request_comment_author(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.request_comments rc
    where rc.author_id = target_profile
      and public.can_access_request(rc.request_id)
  );
$$;

revoke all on function public.can_view_request_comment_author(uuid) from public, anon;
grant execute on function public.can_view_request_comment_author(uuid) to authenticated;

drop policy if exists profiles_read_self_manager_or_request_comment_author
  on public.profiles;

create policy profiles_read_self_manager_or_request_comment_author
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_manager()
    or public.can_view_request_comment_author(id)
  );

comment on function public.can_view_request_comment_author(uuid) is
  'Verifica, com privilégios controlados e sem recursão RLS, se o perfil é autor de mensagem em solicitação acessível ao usuário.';
