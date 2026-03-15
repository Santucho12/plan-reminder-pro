-- Create user_configs table
CREATE TABLE public.user_configs (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mp_access_token TEXT,
  wpp_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (wpp_status IN ('disconnected', 'pending_qr', 'connected')),
  wpp_qr_code TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own config" ON public.user_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own config" ON public.user_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own config" ON public.user_configs
  FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_user_configs_updated_at
  BEFORE UPDATE ON public.user_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
