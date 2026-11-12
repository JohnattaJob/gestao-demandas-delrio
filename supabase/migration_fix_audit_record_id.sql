-- Corrige a composição dos identificadores compostos na auditoria.
-- Não recria triggers nem altera registros já gravados.

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
    ELSE
        v_old := to_jsonb(OLD);
    END IF;

    IF TG_TABLE_NAME = 'profile_areas' THEN
        v_record_id :=
            (COALESCE(v_new, v_old) ->> 'profile_id')
            || ':' ||
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
        actor_id,
        actor_name,
        actor_email,
        action,
        table_name,
        record_id,
        old_values,
        new_values
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

REVOKE ALL ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
