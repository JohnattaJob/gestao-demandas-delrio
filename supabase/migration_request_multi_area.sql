-- Gestão de Demandas DelRio
-- Estrutura de solicitações multiarea, permissões por responsável e status geral derivado.
-- Aplicar somente depois da atualização da interface para utilizar request_areas.
-- A migração preserva os campos legados requests.area_id e requests.owner_id.

BEGIN;

-- 0. Pré-validação: não iniciar se os registros atuais não puderem ser migrados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.requests r
    LEFT JOIN public.areas a ON a.id = r.area_id
    LEFT JOIN public.profiles p ON p.id = r.owner_id
    WHERE r.owner_id IS NULL
       OR a.id IS NULL
       OR a.active IS DISTINCT FROM true
       OR p.id IS NULL
       OR p.active IS DISTINCT FROM true
       OR NOT EXISTS (
         SELECT 1
         FROM public.profile_areas pa
         WHERE pa.profile_id = r.owner_id
           AND pa.area_id = r.area_id
       )
  ) THEN
    RAISE EXCEPTION
      'Migração interrompida: existe solicitação com área ou responsável inválido/inativo.';
  END IF;
END;
$$;

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
ON CONFLICT (request_id, area_id) DO NOTHING;

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

-- 3. Valida novas atribuições e reatribuições.
CREATE OR REPLACE FUNCTION public.validate_request_area_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_validate_assignment boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_validate_assignment := true;
  ELSE
    v_validate_assignment :=
      NEW.area_id IS DISTINCT FROM OLD.area_id
      OR NEW.owner_id IS DISTINCT FROM OLD.owner_id;
  END IF;

  IF v_validate_assignment THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.areas a
      WHERE a.id = NEW.area_id
        AND a.active = true
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
  BEFORE INSERT OR UPDATE ON public.request_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_request_area_assignment();

-- 4. Toda solicitação nova recebe automaticamente uma atribuição primária.
-- Isso mantém compatibilidade de criação durante a transição da interface.
CREATE OR REPLACE FUNCTION public.create_primary_request_area()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.request_areas (
    request_id, area_id, owner_id, status, is_primary, completed_at, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.area_id, NEW.owner_id, NEW.status, true,
    NEW.completed_at, NEW.created_at, NEW.updated_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_create_primary_area ON public.requests;
CREATE TRIGGER requests_create_primary_area
  AFTER INSERT ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_primary_request_area();

-- 5. O status geral é calculado a partir das áreas ainda abertas.
CREATE OR REPLACE FUNCTION public.sync_request_status_from_areas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_status public.request_status;
  v_previous_setting text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_request_id := OLD.request_id;
  ELSE
    v_request_id := NEW.request_id;
  END IF;

  SELECT
    CASE
      WHEN count(*) = 0 THEN NULL
      WHEN bool_and(ra.status IN ('concluida', 'cancelada')) THEN 'concluida'::public.request_status
      WHEN bool_or(ra.status = 'em_execucao') THEN 'em_execucao'::public.request_status
      WHEN bool_or(ra.status = 'aguardando_aprovacao') THEN 'aguardando_aprovacao'::public.request_status
      WHEN bool_or(ra.status = 'em_analise') THEN 'em_analise'::public.request_status
      ELSE 'recebida'::public.request_status
    END
  INTO v_status
  FROM public.request_areas ra
  WHERE ra.request_id = v_request_id;

  IF v_status IS NOT NULL THEN
    v_previous_setting := current_setting('app.sync_request_status', true);
    PERFORM set_config('app.sync_request_status', 'on', true);

    UPDATE public.requests
    SET status = v_status,
        updated_at = now()
    WHERE id = v_request_id;

    PERFORM set_config('app.sync_request_status', COALESCE(v_previous_setting, ''), true);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS request_areas_sync_request_status ON public.request_areas;
CREATE TRIGGER request_areas_sync_request_status
  AFTER INSERT OR UPDATE OR DELETE ON public.request_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_request_status_from_areas();

-- 6. Impede alteração manual do status geral quando a solicitação já é multiarea.
-- A sincronização interna usa a configuração transacional app.sync_request_status.
CREATE OR REPLACE FUNCTION public.guard_request_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.area_id IS DISTINCT FROM OLD.area_id
       OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.protocol IS DISTINCT FROM OLD.protocol
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'Somente gestores podem alterar os dados administrativos da solicitação.';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND EXISTS (
       SELECT 1
       FROM public.request_areas ra
       WHERE ra.request_id = OLD.id
     )
     AND current_setting('app.sync_request_status', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'O status geral é calculado automaticamente a partir das áreas responsáveis.';
  END IF;

  NEW.updated_at := now();

  IF NEW.status = 'concluida' THEN
    NEW.completed_at := COALESCE(OLD.completed_at, now());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Acesso à solicitação inclui os responsáveis das áreas.
-- O owner legado só mantém acesso quando ainda não existe atribuição em request_areas.
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
         WHERE r.id = target_request
           AND (
             r.requester_id = (SELECT auth.uid())
             OR (
               r.owner_id = (SELECT auth.uid())
               AND NOT EXISTS (
                 SELECT 1
                 FROM public.request_areas legacy_check
                 WHERE legacy_check.request_id = r.id
               )
             )
             OR EXISTS (
               SELECT 1
               FROM public.request_assignees ra
               WHERE ra.request_id = r.id
                 AND ra.profile_id = (SELECT auth.uid())
             )
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

-- 8. RPC usada pela interface para listar integrantes ativos de uma área.
CREATE OR REPLACE FUNCTION public.get_area_members(target_area uuid)
RETURNS TABLE(profile_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
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

-- 9. RPC atômica para criar uma solicitação com uma ou várias áreas.
-- O primeiro par área/responsável será a atribuição primária legada.
CREATE OR REPLACE FUNCTION public.create_request_with_areas(
  p_title text,
  p_description text,
  p_area_ids uuid[],
  p_owner_ids uuid[],
  p_priority public.request_priority,
  p_due_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request_id uuid;
  v_count integer;
  i integer;
BEGIN
  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Usuário inativo ou não autenticado.';
  END IF;

  IF NULLIF(btrim(p_title), '') IS NULL OR p_due_date IS NULL THEN
    RAISE EXCEPTION 'Informe o título e o prazo da solicitação.';
  END IF;

  IF p_area_ids IS NULL OR p_owner_ids IS NULL
     OR cardinality(p_area_ids) < 1
     OR cardinality(p_area_ids) <> cardinality(p_owner_ids) THEN
    RAISE EXCEPTION 'Selecione ao menos uma área e um responsável para cada área.';
  END IF;

  v_count := cardinality(p_area_ids);

  IF EXISTS (
    SELECT 1
    FROM unnest(p_area_ids) AS x(area_id)
    WHERE x.area_id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM unnest(p_owner_ids) AS x(owner_id)
    WHERE x.owner_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Área e responsável são obrigatórios em todas as atribuições.';
  END IF;

  IF (SELECT count(DISTINCT x.area_id) FROM unnest(p_area_ids) AS x(area_id)) <> v_count THEN
    RAISE EXCEPTION 'A mesma área não pode ser adicionada mais de uma vez.';
  END IF;

  INSERT INTO public.requests (
    title, description, area_id, requester_id, owner_id,
    priority, status, due_date
  )
  VALUES (
    btrim(p_title), NULLIF(btrim(COALESCE(p_description, '')), ''),
    p_area_ids[1], (SELECT auth.uid()), p_owner_ids[1],
    p_priority, 'recebida', p_due_date
  )
  RETURNING id INTO v_request_id;

  IF v_count > 1 THEN
    FOR i IN 2..v_count LOOP
      INSERT INTO public.request_areas (
        request_id, area_id, owner_id, status, is_primary
      )
      VALUES (
        v_request_id, p_area_ids[i], p_owner_ids[i], 'recebida', false
      );
    END LOOP;
  END IF;

  RETURN v_request_id;
END;
$$;

-- 10. RPC administrativa para adicionar área ou reatribuir seu responsável.
CREATE OR REPLACE FUNCTION public.assign_request_area(
  p_request_id uuid,
  p_area_id uuid,
  p_owner_id uuid,
  p_is_primary boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_primary boolean;
BEGIN
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Somente gestores podem adicionar áreas ou reatribuir responsáveis.';
  END IF;

  v_is_primary := COALESCE(p_is_primary, false);

  IF NOT EXISTS (SELECT 1 FROM public.requests r WHERE r.id = p_request_id) THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;

  IF v_is_primary THEN
    UPDATE public.request_areas
    SET is_primary = false
    WHERE request_id = p_request_id
      AND is_primary = true
      AND area_id <> p_area_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.request_areas ra
    WHERE ra.request_id = p_request_id AND ra.is_primary = true
  ) THEN
    v_is_primary := true;
  END IF;

  INSERT INTO public.request_areas (
    request_id, area_id, owner_id, status, is_primary
  )
  VALUES (
    p_request_id, p_area_id, p_owner_id, 'recebida', v_is_primary
  )
  ON CONFLICT (request_id, area_id)
  DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    is_primary = EXCLUDED.is_primary;

  IF v_is_primary THEN
    UPDATE public.requests
    SET area_id = p_area_id,
        owner_id = p_owner_id
    WHERE id = p_request_id;
  END IF;
END;
$$;

-- 11. RLS: leitura para participantes; alteração de status somente pelo responsável
-- da área (desde que não seja o próprio solicitante) ou por gestor.
ALTER TABLE public.request_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_areas_read_authorized ON public.request_areas;
CREATE POLICY request_areas_read_authorized
  ON public.request_areas
  FOR SELECT TO authenticated
  USING (public.can_access_request(request_id));

DROP POLICY IF EXISTS request_areas_update_authorized ON public.request_areas;
DROP POLICY IF EXISTS request_areas_manage_manager ON public.request_areas;
CREATE POLICY request_areas_update_authorized
  ON public.request_areas
  FOR UPDATE TO authenticated
  USING (
    public.is_manager()
    OR (
      owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.requests r
        WHERE r.id = request_areas.request_id
          AND r.requester_id <> (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    public.is_manager()
    OR (
      owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.requests r
        WHERE r.id = request_areas.request_id
          AND r.requester_id <> (SELECT auth.uid())
      )
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.request_areas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.request_areas TO authenticated;
GRANT UPDATE (status) ON TABLE public.request_areas TO authenticated;

-- 12. Auditoria da nova tabela. Mantém a regra de ignorar UPDATE sem mudanças
-- e identifica cada vínculo pelo par request_id:area_id.
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
        IF TG_TABLE_NAME = 'request_areas' THEN
            v_record_id := (COALESCE(v_new, v_old) ->> 'request_id');
        ELSE
            v_record_id := (COALESCE(v_new, v_old) ->> 'profile_id');
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

-- 13. Privilégios das funções.
REVOKE ALL PRIVILEGES ON FUNCTION public.can_access_request(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_request(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.get_area_members(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_area_members(uuid) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_request_with_areas(
  text, text, uuid[], uuid[], public.request_priority, date
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_request_with_areas(
  text, text, uuid[], uuid[], public.request_priority, date
) TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.assign_request_area(uuid, uuid, uuid, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_request_area(uuid, uuid, uuid, boolean)
  TO authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.validate_request_area_assignment()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.create_primary_request_area()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_request_status_from_areas()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.write_audit_log()
  FROM PUBLIC, anon, authenticated;

-- 14. Gatilho de auditoria da nova tabela.
DROP TRIGGER IF EXISTS audit_request_areas_changes ON public.request_areas;
CREATE TRIGGER audit_request_areas_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.request_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.write_audit_log();

COMMIT;
