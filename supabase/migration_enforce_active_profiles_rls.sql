-- Gestão de Demandas DelRio
-- Garante bloqueio imediato de acesso no banco para perfis desativados,
-- inclusive quando a sessão Auth ainda estiver válida.
-- Não altera dados, históricos, permissões de usuários ativos ou regras de negócio.

BEGIN;

-- 1. Acesso a solicitações exige perfil ativo antes de avaliar participação.
CREATE OR REPLACE FUNCTION public.can_access_request(target_request uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_active_user()
     AND (
       public.is_manager()
       OR EXISTS (
         SELECT 1
         FROM public.requests r
         LEFT JOIN public.request_assignees ra
           ON ra.request_id = r.id
         WHERE r.id = target_request
           AND (
             r.requester_id = (SELECT auth.uid())
             OR r.owner_id = (SELECT auth.uid())
             OR ra.profile_id = (SELECT auth.uid())
           )
       )
     );
$$;

-- 2. Áreas e materiais: bloquear leitura por sessões de perfis inativos.
DROP POLICY IF EXISTS areas_read_authenticated ON public.areas;
CREATE POLICY areas_read_authenticated
  ON public.areas
  FOR SELECT
  TO authenticated
  USING (active = true AND public.is_active_user());

DROP POLICY IF EXISTS materials_read_authenticated ON public.materials;
CREATE POLICY materials_read_authenticated
  ON public.materials
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- 3. Notificações: o destinatário também precisa continuar ativo.
DROP POLICY IF EXISTS notifications_read_own ON public.notifications;
CREATE POLICY notifications_read_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND public.is_active_user()
  );

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND public.is_active_user()
  )
  WITH CHECK (
    recipient_id = (SELECT auth.uid())
    AND public.is_active_user()
  );

-- 4. Pedidos: bloquear leitura de pedidos por solicitantes desativados.
DROP POLICY IF EXISTS material_orders_select_access ON public.material_orders;
CREATE POLICY material_orders_select_access
  ON public.material_orders
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      requester_id = (SELECT auth.uid())
      OR public.can_manage_stock()
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.active = true
          AND p.role = 'gestor'::public.app_role
          AND (
            p.area_id = material_orders.area_id
            OR EXISTS (
              SELECT 1
              FROM public.profile_areas pa
              WHERE pa.profile_id = p.id
                AND pa.area_id = material_orders.area_id
            )
          )
      )
    )
  );

-- 5. Itens: bloquear inclusão, alteração e exclusão por solicitante inativo.
DROP POLICY IF EXISTS material_order_items_insert_own ON public.material_order_items;
CREATE POLICY material_order_items_insert_own
  ON public.material_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.material_orders mo
      WHERE mo.id = material_order_items.order_id
        AND mo.requester_id = (SELECT auth.uid())
        AND mo.status = 'aguardando_aprovacao_gestor'::text
    )
    AND EXISTS (
      SELECT 1
      FROM public.materials m
      WHERE m.id = material_order_items.material_id
        AND m.active = true
    )
  );

DROP POLICY IF EXISTS material_order_items_update_own ON public.material_order_items;
CREATE POLICY material_order_items_update_own
  ON public.material_order_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.material_orders mo
      WHERE mo.id = material_order_items.order_id
        AND mo.requester_id = (SELECT auth.uid())
        AND mo.status = 'aguardando_aprovacao_gestor'::text
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.material_orders mo
      WHERE mo.id = material_order_items.order_id
        AND mo.requester_id = (SELECT auth.uid())
        AND mo.status = 'aguardando_aprovacao_gestor'::text
    )
  );

DROP POLICY IF EXISTS material_order_items_delete_own ON public.material_order_items;
CREATE POLICY material_order_items_delete_own
  ON public.material_order_items
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.material_orders mo
      WHERE mo.id = material_order_items.order_id
        AND mo.requester_id = (SELECT auth.uid())
        AND mo.status = 'aguardando_aprovacao_gestor'::text
    )
  );

COMMIT;
