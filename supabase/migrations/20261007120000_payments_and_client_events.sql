-- client_id es TEXT porque en la base real clients.id es TEXT (no uuid)
-- Pagos registrados (cobros y renovaciones)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Si el cliente se elimina el pago queda en el historial (por eso se guarda también el nombre)
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  cliente_nombre TEXT NOT NULL,
  plan TEXT DEFAULT '',
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  medio TEXT NOT NULL DEFAULT 'transferencia',
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  vencimiento_anterior DATE,
  vencimiento_nuevo DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own payments" ON public.payments;
CREATE POLICY "Users can insert their own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own payments" ON public.payments;
CREATE POLICY "Users can delete their own payments" ON public.payments
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_fecha ON public.payments(user_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);

-- Línea de tiempo del cliente: mensajes enviados, notas y cambios de seguimiento
CREATE TABLE IF NOT EXISTS public.client_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('mensaje', 'nota', 'estado')),
  detalle TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own client events" ON public.client_events;
CREATE POLICY "Users can view their own client events" ON public.client_events
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own client events" ON public.client_events;
CREATE POLICY "Users can insert their own client events" ON public.client_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own client events" ON public.client_events;
CREATE POLICY "Users can delete their own client events" ON public.client_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_client_events_client ON public.client_events(client_id, created_at DESC);

-- Seguimiento manual del cliente: prometio_pago, no_molestar, baja (NULL = sin seguimiento)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS seguimiento TEXT
  CHECK (seguimiento IS NULL OR seguimiento IN ('prometio_pago', 'no_molestar', 'baja'));
