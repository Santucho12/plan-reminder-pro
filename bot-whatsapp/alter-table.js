require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addCols() {
  const query = `
    ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_recordatorio TEXT DEFAULT 'Hola [Nombre], ¿cómo estás? Te recordamos que tu plan [Plan] va a vencer en [Dias]. El total es $[Total]. ¡Que tengas un buen día! 💪';
    ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_vencimiento_hoy TEXT DEFAULT 'Hola [Nombre], tu plan [Plan] venció hoy. El total es $[Total].';
    ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_vencido TEXT DEFAULT 'Hola [Nombre], notamos que tu plan [Plan] ya se encuentra vencido. El total para renovarlo es $[Total].';
    ALTER TABLE user_configs ADD COLUMN IF NOT EXISTS msg_recuperacion TEXT DEFAULT 'Hola [Nombre], notamos que hace un tiempo tu plan [Plan] se encuentra vencido. El total para renovarlo es $[Total]. ¿Te gustaría renovarlo?';
  `;
  try {
    // Supabase REST doesn't support raw SQL from JS client. So we will just use supabase-js to update user_configs. but wait.
    console.log("We can't alter table via REST without RPC...");
  } catch (err) {
    console.error(err);
  }
}

addCols();
