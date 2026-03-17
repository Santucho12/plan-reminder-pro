-- Agrega las columnas para edición de mensajes a la tabla user_configs
ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_recordatorio TEXT;
ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_vencimiento_hoy TEXT;
ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_vencido TEXT;
ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_recuperacion TEXT;
