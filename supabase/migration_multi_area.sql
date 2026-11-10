-- Gestão de Demandas DelRio: suporte a múltiplas áreas por colaborador
-- Execute uma única vez no SQL Editor. Não apaga nem altera solicitações existentes.

insert into public.areas(name)
values ('Social Media')
on conflict (name) do nothing;

create table if not exists public.profile_areas (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, area_id)
);

alter table public.profile_areas enable row level security;

drop policy if exists "Managers can view profile areas" on public.profile_areas;
create policy "Managers can view profile areas" on public.profile_areas
for select to authenticated
using (public.is_manager() or profile_id = (select auth.uid()));

drop policy if exists "Admins manage profile areas" on public.profile_areas;
create policy "Admins manage profile areas" on public.profile_areas
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin'));

-- Migra vínculos atuais da coluna antiga para a tabela de relacionamento.
insert into public.profile_areas(profile_id, area_id)
select id, area_id from public.profiles where area_id is not null
on conflict do nothing;

-- Atualiza a função administrativa para receber uma lista de áreas.
create or replace function public.admin_update_profile_areas(
  target_profile uuid,
  new_full_name text,
  new_role public.app_role,
  new_area_ids uuid[],
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  area_item uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active = true and p.role = 'admin'
  ) then
    raise exception 'Apenas administradores podem gerenciar perfis de colaboradores.';
  end if;

  if target_profile = (select auth.uid()) and new_role <> 'admin' then
    raise exception 'Não é permitido remover o próprio perfil de administrador.';
  end if;

  foreach area_item in array coalesce(new_area_ids, array[]::uuid[]) loop
    if not exists (select 1 from public.areas a where a.id = area_item and a.active = true) then
      raise exception 'Uma das áreas selecionadas não existe ou está inativa.';
    end if;
  end loop;

  update public.profiles
  set full_name = nullif(trim(new_full_name), ''),
      role = new_role,
      area_id = coalesce((new_area_ids)[1], null),
      active = new_active
  where id = target_profile;

  if not found then raise exception 'Colaborador não encontrado.'; end if;

  delete from public.profile_areas where profile_id = target_profile;
  insert into public.profile_areas(profile_id, area_id)
  select target_profile, x from unnest(coalesce(new_area_ids, array[]::uuid[])) as x
  on conflict do nothing;
end;
$$;

revoke all on function public.admin_update_profile_areas(uuid, text, public.app_role, uuid[], boolean) from public;
grant execute on function public.admin_update_profile_areas(uuid, text, public.app_role, uuid[], boolean) to authenticated;
