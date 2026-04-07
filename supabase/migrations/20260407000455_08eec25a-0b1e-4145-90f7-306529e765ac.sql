
ALTER TABLE public.clients DROP CONSTRAINT clients_estado_check;
UPDATE public.clients SET estado = 'activo' WHERE estado = 'pagado';
ALTER TABLE public.clients ADD CONSTRAINT clients_estado_check CHECK (estado = ANY (ARRAY['activo'::text, 'pendiente'::text, 'vencido'::text]));
