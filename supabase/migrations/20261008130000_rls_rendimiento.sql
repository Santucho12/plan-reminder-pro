-- Políticas RLS con (select auth.uid()): Postgres lo evalúa una sola vez por consulta en lugar de
-- una vez por fila (aviso auth_rls_initplan del linter de Supabase). Mismo comportamiento.
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'user_configs', 'payments', 'client_events'] LOOP
    -- Borra cualquier política previa de la tabla (nombres viejos o nuevos) y deja las cuatro estándar
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Own rows select" ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows insert" ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows update" ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id)', t);
    EXECUTE format('CREATE POLICY "Own rows delete" ON public.%I FOR DELETE TO authenticated USING ((select auth.uid()) = user_id)', t);
  END LOOP;
END $$;

-- Índice para la clave foránea client_events.user_id (aviso unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_client_events_user_id ON public.client_events(user_id);
