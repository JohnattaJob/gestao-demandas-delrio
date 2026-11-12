-- Padroniza o search_path da função de aprovação do gestor.
-- Todas as referências a objetos nesta função já utilizam o schema explícito public.
-- A alteração não modifica a lógica de aprovação nem as permissões de execução.

BEGIN;

ALTER FUNCTION public.approve_material_order_manager(uuid)
  SET search_path = '';

COMMIT;
