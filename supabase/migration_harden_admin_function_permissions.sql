-- Restringe a execução das funções administrativas a usuários autenticados.
-- As próprias funções continuam validando se o usuário é administrador ativo.

BEGIN;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_set_stock_permission(uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_stock_permission(uuid, boolean)
  TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_update_profile(uuid, text, public.app_role, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, public.app_role, uuid, boolean)
  TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_update_profile_areas(uuid, text, public.app_role, uuid[], boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_areas(uuid, text, public.app_role, uuid[], boolean)
  TO authenticated;

COMMIT;
