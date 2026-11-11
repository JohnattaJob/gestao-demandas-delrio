-- Gestão de Demandas DelRio | consulta geral de colaboradores
-- Permite que todos os usuários ativos consultem dados cadastrais e áreas vinculadas.
-- A edição continua restrita aos administradores pelas funções e políticas existentes.

begin;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

drop policy if exists profiles_read_self_or_manager on public.profiles;
drop policy if exists profiles_read_authenticated on public.profiles;
create policy profiles_read_authenticated
  on public.profiles
  for select
  to authenticated
  using (public.is_active_user());

drop policy if exists "Managers can view profile areas" on public.profile_areas;
drop policy if exists profile_areas_read_authenticated on public.profile_areas;
create policy profile_areas_read_authenticated
  on public.profile_areas
  for select
  to authenticated
  using (public.is_active_user());

comment on function public.is_active_user() is
  'Verifica se o usuário autenticado possui perfil ativo, sem recursão de RLS.';

commit;
