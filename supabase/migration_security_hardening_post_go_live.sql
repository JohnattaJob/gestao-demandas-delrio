-- Hardening complementar de permissões das tabelas públicas.
-- Reproduz as restrições testadas na homologação pós-Go-Live.
-- Não altera privilégios de postgres ou service_role.

BEGIN;

-- Perfis: leitura direta; alterações administrativas via RPC.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- Relação entre perfis e áreas: leitura direta; alterações via RPC.
REVOKE ALL PRIVILEGES ON TABLE public.profile_areas FROM anon, authenticated;
GRANT SELECT ON TABLE public.profile_areas TO authenticated;

-- Áreas: somente leitura direta.
REVOKE ALL PRIVILEGES ON TABLE public.areas FROM anon, authenticated;
GRANT SELECT ON TABLE public.areas TO authenticated;

-- Notificações: leitura e atualização somente do indicador de leitura.
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;

-- Solicitações: leitura e alteração somente da prioridade diretamente.
-- Demais alterações seguem pelas operações autorizadas da aplicação.
REVOKE ALL PRIVILEGES ON TABLE public.requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.requests TO authenticated;
GRANT UPDATE (priority) ON TABLE public.requests TO authenticated;

-- Responsáveis das solicitações: leitura direta.
REVOKE ALL PRIVILEGES ON TABLE public.request_assignees FROM anon, authenticated;
GRANT SELECT ON TABLE public.request_assignees TO authenticated;

-- Histórico de materiais: somente leitura direta.
REVOKE ALL PRIVILEGES ON TABLE public.material_order_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.material_order_history TO authenticated;

-- Auditoria: somente leitura direta.
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

COMMIT;
