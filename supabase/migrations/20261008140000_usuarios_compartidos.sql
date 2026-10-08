-- =====================================================================
-- Dos usuarios que comparten los mismos datos:
--   * admin    -> fijo (no se cambia desde la app)
--   * usuario  -> configurable (mail y contraseña se cambian desde Configuración)
-- Todos los datos pertenecen a un "espacio de trabajo" (workspace_id = id del admin): la columna
-- user_id de las tablas guarda ese workspace, y cada usuario ve las filas de su workspace.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.app_members (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'usuario')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un solo admin y un solo usuario configurable por workspace
CREATE UNIQUE INDEX IF NOT EXISTS app_members_workspace_rol ON public.app_members(workspace_id, rol);

-- Nadie la lee ni la modifica directo desde la app: solo a través de las funciones de abajo
ALTER TABLE public.app_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_members FROM anon, authenticated;
GRANT ALL ON public.app_members TO service_role;

-- Workspace del usuario logueado (NULL si no es miembro)
CREATE OR REPLACE FUNCTION public.current_workspace()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT workspace_id FROM public.app_members WHERE user_id = auth.uid()
$$;

-- Usuarios del workspace con su mail, para mostrarlos en Configuración
CREATE OR REPLACE FUNCTION public.list_members()
RETURNS TABLE (user_id UUID, email TEXT, rol TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.user_id, u.email::text, m.rol
  FROM public.app_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.workspace_id = public.current_workspace()
  ORDER BY m.rol
$$;

REVOKE EXECUTE ON FUNCTION public.current_workspace() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_members() TO authenticated;

-- Las políticas pasan de "mis filas" a "las filas de mi workspace"
DO $$
DECLARE
  t TEXT;
  p RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients', 'user_configs', 'payments', 'client_events'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Workspace select" ON public.%I FOR SELECT TO authenticated USING (user_id = (select public.current_workspace()))', t);
    EXECUTE format('CREATE POLICY "Workspace insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (select public.current_workspace()))', t);
    EXECUTE format('CREATE POLICY "Workspace update" ON public.%I FOR UPDATE TO authenticated USING (user_id = (select public.current_workspace())) WITH CHECK (user_id = (select public.current_workspace()))', t);
    EXECUTE format('CREATE POLICY "Workspace delete" ON public.%I FOR DELETE TO authenticated USING (user_id = (select public.current_workspace()))', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
