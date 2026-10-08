-- =====================================================================
-- FiestaCobra: esquema completo para un proyecto de Supabase nuevo.
-- Reúne todas las migraciones en un solo script. Se puede ejecutar más
-- de una vez sin errores (no borra datos). Ejecutarlo COMPLETO en el SQL Editor.
-- Refleja la base en producción (proyecto pmrqctvcmkgyijrqsuff).
-- =====================================================================

-- ---------- Función para mantener updated_at ----------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------- Clientes ----------
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT DEFAULT '',
  celular TEXT NOT NULL DEFAULT '',
  plan TEXT DEFAULT '',
  vencimiento DATE NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('activo', 'pendiente', 'vencido')),
  dias INTEGER DEFAULT 0,
  ultimo_mensaje TIMESTAMPTZ,
  nota_plataforma TEXT,
  nota_precio TEXT,
  -- Seguimiento manual: prometio_pago, no_molestar, baja (NULL = sin seguimiento)
  seguimiento TEXT CHECK (seguimiento IS NULL OR seguimiento IN ('prometio_pago', 'no_molestar', 'baja')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Si la tabla ya existía (creada a medias o con una versión vieja), completar las columnas que falten
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS dias INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ultimo_mensaje TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nota_plataforma TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nota_precio TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS seguimiento TEXT
  CHECK (seguimiento IS NULL OR seguimiento IN ('prometio_pago', 'no_molestar', 'baja'));

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_vencimiento ON public.clients(vencimiento);

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Configuración del usuario ----------
-- settings guarda plantillas, datos de cobro y catálogo de plataformas/combos.
CREATE TABLE IF NOT EXISTS public.user_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_configs ADD COLUMN IF NOT EXISTS settings JSONB;

DROP TRIGGER IF EXISTS update_user_configs_updated_at ON public.user_configs;
CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON public.user_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Pagos registrados ----------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Si el cliente se elimina el pago queda en el historial (por eso se guarda también el nombre)
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nombre TEXT NOT NULL,
  plan TEXT DEFAULT '',
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  medio TEXT NOT NULL DEFAULT 'transferencia',
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  vencimiento_anterior DATE,
  vencimiento_nuevo DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_fecha ON public.payments(user_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);

-- ---------- Historial del cliente (mensajes, notas, seguimiento) ----------
CREATE TABLE IF NOT EXISTS public.client_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('mensaje', 'nota', 'estado')),
  detalle TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_events_client ON public.client_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_events_user_id ON public.client_events(user_id);

-- ---------- Usuarios: admin fijo + usuario configurable, que comparten los datos ----------
-- Los usuarios se crean en Auth y se registran en app_members (ver README). user_id de las tablas
-- de datos guarda el workspace (= id del admin).
CREATE TABLE IF NOT EXISTS public.app_members (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'usuario')),
  -- Copia legible de la contraseña para mostrarla en Configuración (Auth solo guarda el hash)
  clave TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un solo admin y un solo usuario configurable por workspace
CREATE UNIQUE INDEX IF NOT EXISTS app_members_workspace_rol ON public.app_members(workspace_id, rol);

-- Nadie la lee ni la modifica directo desde la app: solo a través de las funciones de abajo
ALTER TABLE public.app_members ADD COLUMN IF NOT EXISTS clave TEXT;
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
DROP FUNCTION IF EXISTS public.list_members();
CREATE FUNCTION public.list_members()
RETURNS TABLE (user_id UUID, email TEXT, rol TEXT, clave TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.user_id, u.email::text, m.rol, m.clave
  FROM public.app_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.workspace_id = public.current_workspace()
  ORDER BY m.rol
$$;

REVOKE EXECUTE ON FUNCTION public.current_workspace() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_members() TO authenticated;

-- ---------- Seguridad: cada usuario ve y modifica solo lo de su workspace ----------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

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
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- La app solo se usa logueado: el rol anónimo no tiene permisos sobre las tablas
REVOKE ALL ON public.clients, public.user_configs, public.payments, public.client_events FROM anon;

-- ---------- Tiempo real: la app se refresca sola cuando cambian los clientes ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
END $$;

-- Que la API vea las tablas nuevas enseguida
NOTIFY pgrst, 'reload schema';
