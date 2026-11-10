-- Gestão de Demandas DelRio
-- Exclusão lógica de solicitações com regras por perfil.
-- Execute uma única vez no SQL Editor do Supabase.

alter table public.requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create or replace function public.soft_delete_request(target_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role public.app_role;
  request_owner uuid;
begin
  select p.role
    into actor_role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true;

  if actor_role is null then
    raise exception 'Usuário não encontrado ou inativo.';
  end if;

  select r.requester_id
    into request_owner
  from public.requests r
  where r.id = target_request
    and r.deleted_at is null;

  if not found then
    raise exception 'Solicitação não encontrada ou já excluída.';
  end if;

  if actor_role not in ('admin', 'gestor')
     and request_owner is distinct from (select auth.uid()) then
    raise exception 'Colaboradores só podem excluir solicitações abertas por eles mesmos.';
  end if;

  update public.requests
  set deleted_at = now(),
      deleted_by = (select auth.uid())
  where id = target_request
    and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_request(uuid) from public;
revoke all on function public.soft_delete_request(uuid) from anon;
grant execute on function public.soft_delete_request(uuid) to authenticated;

comment on column public.requests.deleted_at is
  'Data e hora da exclusão lógica da solicitação; registros excluídos são ocultados das consultas normais.';
comment on column public.requests.deleted_by is
  'Perfil que realizou a exclusão lógica da solicitação.';
