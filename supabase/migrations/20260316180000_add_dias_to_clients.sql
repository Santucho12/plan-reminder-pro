-- Add 'dias' column to 'clients' table
ALTER TABLE public.clients ADD COLUMN dias INTEGER DEFAULT 0;
qu