-- Central de notificações da Gestão de Demandas DelRio
-- Execute uma única vez no SQL Editor do Supabase, depois das migrações de Pedidos de Materiais
-- e da migração multiárea. Não altera nem remove pedidos existentes.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  material_order_id uuid references public.material_orders(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

create or replace function public.notify_material_order_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_protocol bigint;
  v_area_name text;
  v_requester_name text;
  v_title text;
  v_message text;
  v_type text;
begin
  select mo.protocol, a.name, p.full_name
    into v_protocol, v_area_name, v_requester_name
  from public.material_orders mo
  join public.areas a on a.id = mo.area_id
  join public.profiles p on p.id = mo.requester_id
  where mo.id = new.id;

  if tg_op = 'INSERT' then
    if new.status = 'aguardando_aprovacao_gestor' then
      insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
      select distinct p.id,
        'Pedido de materiais aguardando aprovação',
        'O pedido #' || v_protocol || ' da área ' || v_area_name || ' aguarda sua aprovação.',
        'material_order_pending_manager',
        new.id
      from public.profiles p
      where p.active = true
        and (
          p.role = 'admin'
          or (
            p.role = 'gestor'
            and (
              p.area_id = new.area_id
              or exists (
                select 1 from public.profile_areas pa
                where pa.profile_id = p.id and pa.area_id = new.area_id
              )
            )
          )
        );
    elsif new.status = 'aguardando_aprovacao_estoque' then
      insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
      select p.id,
        'Pedido aguardando aprovação do estoque',
        'O pedido #' || v_protocol || ' da área ' || v_area_name || ' aguarda análise do estoque.',
        'material_order_pending_stock',
        new.id
      from public.profiles p
      where p.active = true and (p.role = 'admin' or p.stock_manager = true);
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'aguardando_aprovacao_estoque' then
    v_title := 'Pedido aprovado pelo gestor';
    v_message := 'Seu pedido #' || v_protocol || ' foi aprovado pelo gestor e aguarda aprovação do estoque.';
    v_type := 'material_order_manager_approved';

    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (new.requester_id,v_title,v_message,v_type,new.id);

    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    select p.id,
      'Pedido aguardando aprovação do estoque',
      'O pedido #' || v_protocol || ' da área ' || v_area_name || ' aguarda análise do estoque.',
      'material_order_pending_stock',
      new.id
    from public.profiles p
    where p.active = true and (p.role = 'admin' or p.stock_manager = true);

  elsif new.status = 'rejeitado_gestor' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido reprovado pelo gestor',
      'Seu pedido #' || v_protocol || ' foi reprovado pelo gestor.' ||
        case when nullif(trim(new.rejection_reason),'') is not null then ' Motivo: ' || new.rejection_reason else '' end,
      'material_order_manager_rejected',
      new.id
    );

  elsif new.status = 'rejeitado_estoque' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido reprovado pelo estoque',
      'Seu pedido #' || v_protocol || ' foi reprovado pelo estoque.' ||
        case when nullif(trim(new.rejection_reason),'') is not null then ' Motivo: ' || new.rejection_reason else '' end,
      'material_order_stock_rejected',
      new.id
    );

  elsif new.status = 'em_separacao' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido aprovado pelo estoque',
      'Seu pedido #' || v_protocol || ' foi aprovado e os materiais estão em separação.',
      'material_order_stock_approved',
      new.id
    );

  elsif new.status = 'aguardando_retirada' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido liberado para retirada',
      'Os materiais do pedido #' || v_protocol || ' estão disponíveis para retirada.',
      'material_order_ready_for_pickup',
      new.id
    );

  elsif new.status = 'concluido' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido de materiais concluído',
      'A entrega do pedido #' || v_protocol || ' foi confirmada e o pedido está concluído.',
      'material_order_completed',
      new.id
    );

  elsif new.status = 'cancelado' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    values (
      new.requester_id,
      'Pedido de materiais cancelado',
      'O pedido #' || v_protocol || ' foi cancelado.',
      'material_order_cancelled',
      new.id
    );

  elsif new.status = 'aguardando_aprovacao_gestor' then
    insert into public.notifications(recipient_id,title,message,notification_type,material_order_id)
    select distinct p.id,
      'Pedido de materiais aguardando aprovação',
      'O pedido #' || v_protocol || ' da área ' || v_area_name || ' aguarda sua aprovação.',
      'material_order_pending_manager',
      new.id
    from public.profiles p
    where p.active = true
      and (
        p.role = 'admin'
        or (
          p.role = 'gestor'
          and (
            p.area_id = new.area_id
            or exists (
              select 1 from public.profile_areas pa
              where pa.profile_id = p.id and pa.area_id = new.area_id
            )
          )
        )
      );
  end if;

  return new;
end;
$$;

drop trigger if exists material_order_notifications_trigger on public.material_orders;
create trigger material_order_notifications_trigger
  after insert or update of status on public.material_orders
  for each row execute function public.notify_material_order_events();

-- Habilita eventos em tempo real para a central, sem duplicar a tabela na publicação.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
