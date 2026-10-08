-- Contraseña visible en Configuración → Accesos (pedido del cliente).
-- Supabase Auth guarda solo el hash, así que se guarda una copia legible en app_members.
-- La tabla no es accesible desde la API: solo la devuelve list_members() a los miembros del
-- workspace, y la escribe la Edge Function manage-user al cambiar la contraseña.
ALTER TABLE public.app_members ADD COLUMN IF NOT EXISTS clave TEXT;

-- El admin es fijo
UPDATE public.app_members SET clave = '12345678' WHERE rol = 'admin' AND clave IS NULL;

-- Cambia el tipo de retorno: hay que recrearla
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

REVOKE EXECUTE ON FUNCTION public.list_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_members() TO authenticated;

NOTIFY pgrst, 'reload schema';
