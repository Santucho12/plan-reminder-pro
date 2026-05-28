-- Tipos distintos para vencidos 1-30 días vs recuperación (+30 días)
ALTER TABLE public.messages_log DROP CONSTRAINT IF EXISTS messages_log_tipo_check;

ALTER TABLE public.messages_log ADD CONSTRAINT messages_log_tipo_check
  CHECK (tipo IN ('recordatorio', 'vencimiento', 'vencido', 'recuperacion', 'pago_confirmado'));
