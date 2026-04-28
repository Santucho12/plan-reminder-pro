-- Add notes to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nota_plataforma TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS nota_precio TEXT;
