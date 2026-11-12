-- Gestão de Demandas DelRio
-- Permite que participantes de uma solicitação vejam o nome dos autores
-- das mensagens daquela conversa, sem liberar a leitura geral dos perfis.
-- Execute uma única vez no SQL Editor do Supabase.

drop policy if exists profiles_read_self_or_manager on public.profiles;
create policy profiles_read_self_manager_or_request_comment_author
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.is_manager()
    or exists (
      select 1
      from public.request_comments rc
      where rc.author_id = profiles.id
        and public.can_access_request(rc.request_id)
    )
  );

comment on policy profiles_read_self_manager_or_request_comment_author
  on public.profiles is
  'Permite ler o perfil do próprio usuário, gestores e autores de mensagens em solicitações às quais o usuário tem acesso.';
