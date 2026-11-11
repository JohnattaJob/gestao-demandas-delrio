-- Auditoria geral centralizada
-- Registra alterações operacionais sem substituir os históricos específicos existentes.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_name text,
    actor_email text,
    action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name text NOT NULL,
    record_id text,
    old_values jsonb,
    new_values jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
    ON public.audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx
    ON public.audit_logs (table_name, record_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_admin ON public.audit_logs;

CREATE POLICY audit_logs_select_admin
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = (SELECT auth.uid())
              AND p.active = true
              AND p.role::text = 'admin'
        )
    );

REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

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
        v_record_id := COALESCE(
            v_new ->> 'id',
            v_new ->> 'profile_id',
            v_new ->> 'request_id',
            v_new ->> 'order_id'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := COALESCE(
            v_new ->> 'id',
            v_new ->> 'profile_id',
            v_new ->> 'request_id',
            v_new ->> 'order_id'
        );
    ELSE
        v_old := to_jsonb(OLD);
        v_record_id := COALESCE(
            v_old ->> 'id',
            v_old ->> 'profile_id',
            v_old ->> 'request_id',
            v_old ->> 'order_id'
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

DO $block$
DECLARE
    v_table text;
BEGIN
    FOREACH v_table IN ARRAY ARRAY[
        'areas',
        'profiles',
        'profile_areas',
        'requests',
        'request_assignees',
        'request_comments',
        'materials',
        'material_orders',
        'material_order_items',
        'stock_movements'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS audit_%I_changes ON public.%I',
            v_table,
            v_table
        );

        EXECUTE format(
            'CREATE TRIGGER audit_%I_changes
             AFTER INSERT OR UPDATE OR DELETE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION public.write_audit_log()',
            v_table,
            v_table
        );
    END LOOP;
END;
$block$;
