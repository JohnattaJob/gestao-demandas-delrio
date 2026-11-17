-- Gestão de Demandas DelRio
-- Etapa 1: estrutura de áreas responsáveis por solicitação e migração dos registros atuais.
-- Esta migração não altera a interface nem substitui os campos legados de requests.
-- Execute somente após revisar e aprovar o SQL.

BEGIN;

-- 1. Relação entre solicitação, área e responsável daquela área.
CREATE TABLE IF NOT EXISTS public.request_areas (
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  status public.request_status NOT NULL DEFAULT 'recebida',
  is_primary boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_areas_pkey PRIMARY KEY (request_id, area_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS request_areas_one_primary_idx
  ON public.request_areas(request_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS request_areas_area_id_idx
  ON public.request_areas(area_id);
CREATE INDEX IF NOT EXISTS request_areas_owner_id_idx
  ON public.request_areas(owner_id);
CREATE INDEX IF NOT EXISTS request_areas_request_id_idx
  ON public.request_areas(request_id);

-- 2. Migra todas as solicitações existentes, inclusive as excluídas logicamente.
-- A área/responsável atuais passam a ser a atribuição primária.
INSERT INTO public.request_areas (
  request_id, area_id, owner_id, status, is_primary, completed_at, created_at, updated_at
)
SELECT
  r.id, r.area_id, r.owner_id, r.status, true, r.completed_at, r.created_at, r.updated_at
FROM public.requests r
WHERE r.owner_id IS NOT NULL
ON CONFLICT (request_id, area_id) DO NOTHING;

-- Interrompe a transação se alguma solicitação não tiver sido migrada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.requests r
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.request_areas ra
      WHERE ra.request_id = r.id
        AND ra.area_id = r.area_id
        AND ra.owner_id = r.owner_id
        AND ra.is_primary = true
    )
  ) THEN
    RAISE EXCEPTION
      'Migração interrompida: existe solicitação sem atribuição primária válida em request_areas.';
  END IF;
END;
$$;

-- 3. Valida novas atribuições e reatribuições: área e responsável precisam estar ativos,
-- e o responsável precisa pertencer à área por meio de profile_areas.
CREATE OR REPLACE FUNCTION public.validate_request_area_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- A validação de vínculo ocorre na criação ou quando área/responsável mudarem.
  -- Uma desativação posterior do cadastro não deve impedir a área de atualizar seu status.
  IF TG_OP = 'INSERT'
     OR NEW.area_id IS DISTINCT FROM OLD.area_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.areas a
      WHERE a.id = NEW.area_id AND a.active = true
    ) THEN
      RAISE EXCEPTION 'A área selecionada não existe ou está inativa.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profile_areas pa
      JOIN public.profiles p ON p.id = pa.profile_id
      WHERE pa.profile_id = NEW.owner_id
        AND pa.area_id = NEW.area_id
        AND p.active = true
    ) THEN
      RAISE EXCEPTION 'O responsável precisa ser um integrante ativo da área selecionada.';
    END IF;
  END IF;

  NEW.updated_at := now();
  IF NEW.status = 'concluida' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS request_areas_validate_assignment ON public.request_areas;
CREATE TRIGGER request_areas_validate_assignment
  BEFORE INSERT OR UPDATE
  ON public.request_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_request_area_assignment();

-- 4. Acesso à solicitação passa a incluir os responsáveis das áreas.
-- Mantém solicitante, responsável legado, colaboradores adicionais e gestores.
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
             OR EXISTS (
               SELECT 1
               FROM public.request_areas request_area
               WHERE request_area.request_id = r.id
                 AND request_area.owner_id = (SELECT auth.uid())
             )
           )
       )
     );
$$;

-- 5. Restaura no histórico local a função RPC já utilizada pela aplicação
-- para listar integrantes ativos de uma área.
CREATE OR REPLACE FUNCTION public.get_area_members(target_area uuid)
RETURNS TABLE(profile_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p.id, p.full_name
  FROM public.profile_areas pa
  JOIN public.profiles p ON p.id = pa.profile_id
  WHERE pa.area_id = target_area
    AND p.active = true
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = (SELECT auth.uid())
        AND me.active = true
    )
  ORDER BY p.full_name;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION public.can_access_request(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_area_members(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_area_members(uuid) TO authenticated;

-- 6. RLS e privilégios explícitos da nova tabela.
ALTER TABLE public.request_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_areas_read_authorized ON public.request_areas;
CREATE POLICY request_areas_read_authorized
  ON public.request_areas
  FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

DROP POLICY IF EXISTS request_areas_manage_manager ON public.request_areas;
CREATE POLICY request_areas_manage_manager
  ON public.request_areas
  FOR ALL TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

REVOKE ALL PRIVILEGES ON TABLE public.request_areas FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.request_areas TO authenticated;

-- 7. Auditoria da nova tabela. Mantém a regra atual de ignorar UPDATE sem mudanças
-- e identifica cada vínculo pelo par request_id:area_id.
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_old jsonb;
    v_new jsonb;
    v_actor_id uuid;
    v_actor_name text;
    v_actor_email text;
    v_record_id text;
BEGIN
    v_actor_id := (SELECT auth.uid());

    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        IF v_old IS NOT DISTINCT FROM v_new THEN
            RETURN NEW;
        END IF;
    ELSE
        v_old := to_jsonb(OLD);
    END IF;

    IF TG_TABLE_NAME IN ('profile_areas', 'request_areas') THEN
        v_record_id :=
            (COALESCE(v_new, v_old) ->> 'profile_id');
        IF TG_TABLE_NAME = 'request_areas' THEN
            v_record_id := (COALESCE(v_new, v_old) ->> 'request_id');
        END IF;
        v_record_id := v_record_id || ':' ||
            (COALESCE(v_new, v_old) ->> 'area_id');
    ELSIF TG_TABLE_NAME = 'request_assignees' THEN
        v_record_id :=
            (COALESCE(v_new, v_old) ->> 'request_id')
            || ':' ||
            (COALESCE(v_new, v_old) ->> 'profile_id');
    ELSE
        v_record_id := COALESCE(
            COALESCE(v_new, v_old) ->> 'id',
            COALESCE(v_new, v_old) ->> 'profile_id',
            COALESCE(v_new, v_old) ->> 'request_id',
            COALESCE(v_new, v_old) ->> 'order_id'
        );
    END IF;

    IF v_actor_id IS NOT NULL THEN
        SELECT p.full_name, p.email
          INTO v_actor_name, v_actor_email
        FROM public.profiles p
        WHERE p.id = v_actor_id;
    END IF;

    INSERT INTO public.audit_logs (
        actor_id, actor_name, actor_email, action, table_name,
        record_id, old_values, new_values
    )
    VALUES (
        v_actor_id,
        COALESCE(v_actor_name, CASE WHEN v_actor_id IS NULL THEN 'Sistema' ELSE 'Usuário' END),
        v_actor_email,
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old,
        v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.write_audit_log()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_request_areas_changes ON public.request_areas;
CREATE TRIGGER audit_request_areas_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.request_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.write_audit_log();

COMMIT;
