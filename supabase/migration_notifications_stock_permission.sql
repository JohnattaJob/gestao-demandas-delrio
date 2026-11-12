-- Regra definitiva da central de notificações de Pedidos de Materiais.
-- Destinatários de todos os eventos: solicitante do pedido e todos os perfis
-- ativos com Permissão de estoque (stock_manager = true).
-- Gestores e administradores não recebem notificações por causa do cargo.

create or replace function public.notify_material_order_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_protocol bigint;
  v_area_name text;
  v_title text;
  v_message text;
  v_type text;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select mo.protocol, a.name
    into v_protocol, v_area_name
  from public.material_orders mo
  join public.areas a on a.id = mo.area_id
  where mo.id = new.id;

  if new.status = 'aguardando_aprovacao_gestor' then
    v_title := 'Pedido aguardando aprovação do gestor';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi criado e aguarda aprovação do gestor.';
    v_type := 'material_order_pending_manager';

  elsif new.status = 'aguardando_aprovacao_estoque' then
    v_title := 'Pedido aguardando aprovação do estoque';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi aprovado pelo gestor e aguarda aprovação do estoque.';
    v_type := 'material_order_pending_stock';

  elsif new.status = 'rejeitado_gestor' then
    v_title := 'Pedido reprovado pelo gestor';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi reprovado pelo gestor.' ||
      case when nullif(trim(new.rejection_reason), '') is not null then ' Motivo: ' || new.rejection_reason else '' end;
    v_type := 'material_order_manager_rejected';

  elsif new.status = 'rejeitado_estoque' then
    v_title := 'Pedido reprovado pelo estoque';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi reprovado pelo estoque.' ||
      case when nullif(trim(new.rejection_reason), '') is not null then ' Motivo: ' || new.rejection_reason else '' end;
    v_type := 'material_order_stock_rejected';

  elsif new.status = 'em_separacao' then
    v_title := 'Pedido em separação';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi aprovado pelo estoque e aguarda separação dos materiais.';
    v_type := 'material_order_pending_separation';

  elsif new.status = 'aguardando_retirada' then
    v_title := 'Pedido liberado para retirada';
    v_message := 'Os materiais do pedido #' || v_protocol || ' da área ' || v_area_name || ' estão disponíveis para retirada.';
    v_type := 'material_order_ready_for_pickup';

  elsif new.status = 'concluido' then
    v_title := 'Pedido de materiais concluído';
    v_message := 'A entrega do pedido #' || v_protocol || ' da área ' || v_area_name || ' foi confirmada e o pedido está concluído.';
    v_type := 'material_order_completed';

  elsif new.status = 'cancelado' then
    v_title := 'Pedido de materiais cancelado';
    v_message := 'O pedido #' || v_protocol || ' da área ' || v_area_name || ' foi cancelado.';
    v_type := 'material_order_cancelled';

  else
    return new;
  end if;

  insert into public.notifications(
    recipient_id,
    title,
    message,
    notification_type,
    material_order_id
  )
  select recipients.id, v_title, v_message, v_type, new.id
  from (
    select new.requester_id as id
    union
    select p.id
    from public.profiles p
    where p.active = true
      and p.stock_manager = true
  ) as recipients
  where recipients.id is not null;

  return new;
end;
$$;

revoke all on function public.notify_material_order_events() from public, anon, authenticated;
