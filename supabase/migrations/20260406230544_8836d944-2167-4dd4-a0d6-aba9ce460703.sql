ALTER TABLE public.user_configs ADD COLUMN IF NOT EXISTS wpp_last_heartbeat timestamp with time zone DEFAULT NULL;

UPDATE public.user_configs SET wpp_status = 'disconnected', wpp_last_heartbeat = NULL WHERE user_id = '97c2807e-c560-465c-9b2a-ee787db37e0b';