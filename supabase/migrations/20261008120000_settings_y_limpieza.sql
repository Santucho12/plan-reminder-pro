-- =====================================================================
-- 1) La configuración (plantillas, datos de cobro y catálogo) pasa a su propia columna jsonb.
-- 2) Se eliminan las columnas y tablas del bot de WhatsApp y de Mercado Pago, que ya no se usan
--    (incluye el access token de MP, que estaba guardado en texto plano).
--
-- IMPORTANTE: aplicar DESPUÉS de publicar la versión nueva de la app (la nueva funciona con y sin
-- esta migración; la vieja deja de poder guardar la configuración una vez aplicada).
-- =====================================================================

ALTER TABLE public.user_configs ADD COLUMN IF NOT EXISTS settings JSONB;

-- Copiar la configuración guardada como texto en msg_recordatorio (solo si es nuestro JSON)
DO $$
DECLARE
  r RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'user_configs' AND column_name = 'msg_recordatorio') THEN
    FOR r IN EXECUTE 'SELECT user_id, msg_recordatorio FROM public.user_configs
                      WHERE settings IS NULL AND msg_recordatorio LIKE ''{%'''
    LOOP
      BEGIN
        IF (r.msg_recordatorio::jsonb ->> 'version') = '1' THEN
          UPDATE public.user_configs SET settings = r.msg_recordatorio::jsonb WHERE user_id = r.user_id;
        END IF;
      EXCEPTION WHEN others THEN
        NULL; -- texto que no es JSON: se ignora
      END;
    END LOOP;
  END IF;
END $$;

-- Columnas viejas de user_configs (textos de la automatización, bot de WhatsApp y Mercado Pago)
ALTER TABLE public.user_configs
  DROP COLUMN IF EXISTS msg_recordatorio,
  DROP COLUMN IF EXISTS msg_vencimiento_hoy,
  DROP COLUMN IF EXISTS msg_vencido,
  DROP COLUMN IF EXISTS msg_vencidos,
  DROP COLUMN IF EXISTS msg_recuperacion,
  DROP COLUMN IF EXISTS payment_alias,
  DROP COLUMN IF EXISTS mp_access_token,
  DROP COLUMN IF EXISTS wpp_status,
  DROP COLUMN IF EXISTS wpp_qr_code,
  DROP COLUMN IF EXISTS wpp_last_heartbeat;

ALTER TABLE public.clients DROP COLUMN IF EXISTS mercadopago_preference_id;

-- Registro de envíos del bot (la app ya no lo usa; el historial nuevo está en client_events)
DROP TABLE IF EXISTS public.messages_log;

-- La app solo escucha cambios en tiempo real de clients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables
             WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_configs') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.user_configs;
  END IF;
END $$;

-- La app solo se usa logueado: el rol anónimo no necesita ningún permiso sobre las tablas
-- (RLS ya lo bloqueaba; esto es una segunda barrera).
REVOKE ALL ON public.clients, public.user_configs, public.payments, public.client_events FROM anon;

NOTIFY pgrst, 'reload schema';
