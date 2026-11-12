-- Hardening das permissões do schema public.
-- Remove acesso anônimo às tabelas e privilégios estruturais desnecessários
-- de authenticated, preservando os privilégios DML sujeitos às policies RLS.
-- Ajusta privilégios padrão dos objetos criados pelo papel postgres.
-- O papel atual não pode alterar os privilégios padrão de supabase_admin.

BEGIN;

-- 1. O aplicativo exige autenticação. RLS não substitui GRANT/REVOKE.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;

-- Usuários autenticados não precisam de privilégios estruturais sobre tabelas.
-- INSERT/SELECT/UPDATE/DELETE existentes são preservados e continuam sujeitos ao RLS.
-- MAINTAIN também é removido (PostgreSQL 17).
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public
  FROM authenticated;

-- Sequências: anon não deve acessá-las; authenticated mantém SELECT/USAGE
-- para não interromper colunas identity/serial, mas não pode alterar a sequência.
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- EXECUTE é concedido a PUBLIC por padrão global no PostgreSQL.
-- Remove esse padrão para funções futuras criadas por postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 2. Corrige privilégios padrão para objetos futuros criados por postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 3. Funções administrativas: somente authenticated pode invocá-las.
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

-- 4. Helpers usados pela aplicação/policies: acesso explícito apenas autenticado.
REVOKE ALL PRIVILEGES ON FUNCTION public.can_access_request(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.can_manage_stock()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_stock() TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_area_members(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_area_members(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_manager()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.can_view_request_comment_author(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_request_comment_author(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_active_user()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

-- 5. Funções chamadas exclusivamente por triggers: não devem ser RPCs públicas.
REVOKE ALL PRIVILEGES ON FUNCTION public.assign_request_owner()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.block_request_stock_movements()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.guard_request_updates()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_request_completed_at()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.release_request_reservations()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.write_audit_log()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.notify_material_order_events()
  FROM PUBLIC, anon, authenticated;

COMMIT;
