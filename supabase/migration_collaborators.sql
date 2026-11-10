-- Gestão de Demandas DelRio | gerenciamento seguro de colaboradores
-- Execute no SQL Editor do Supabase depois de já ter criado as tabelas.
-- Apenas um usuário com perfil admin pode alterar função, área e situação de outro perfil.

create or replace function public.admin_update_profile(
  target_profile uuid,
  new_full_name text,
  new_role public.app_role,
  new_area_id uuid,
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role = 'admin'
  ) then
    raise exception 'Apenas administradores podem gerenciar perfis de colaboradores.';
  end if;

  if target_profile = (select auth.uid()) and new_role <> 'admin' then
    raise exception 'Não é permitido remover o próprio perfil de administrador.';
  end if;

  if new_area_id is not null and not exists (
    select 1 from public.areas a where a.id = new_area_id and a.active = true
  ) then
    raise exception 'A área selecionada não existe ou está inativa.';
  end if;

  update public.profiles
  set full_name = nullif(trim(new_full_name), ''),
      role = new_role,
      area_id = new_area_id,
      active = new_active
  where id = target_profile;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;
end;
$$;

revoke all on function public.admin_update_profile(uuid, text, public.app_role, uuid, boolean) from public;
grant execute on function public.admin_update_profile(uuid, text, public.app_role, uuid, boolean) to authenticated;
