const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = '00000000-0000-0000-0000-000000000000';

async function checkDebug() {
  let output = '';
  output += '--- CHECKING CONFIG ---\n';
  const { data: config, error: configError } = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (configError) output += `Config Error: ${configError.message}\n`;
  else {
    output += `MP Token exists: ${!!config?.mp_access_token}\n`;
    output += `MP Token Value: ${config?.mp_access_token ? config.mp_access_token.substring(0, 15) + '...' : 'NULL'}\n`;
  }

  output += '\n--- CHECKING RECENT MESSAGES ---\n';
  const { data: messages, error: msgError } = await supabase
    .from('messages_log')
    .select('id, tipo, error, created_at, mensaje')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgError) output += `Msg Error: ${msgError.message}\n`;
  else {
    messages.forEach(m => {
      const hasLink = m.mensaje.includes('mercadopago.com') || m.mensaje.includes('init_point');
      output += `- ID: ${m.id} | Tipo: ${m.tipo} | Link: ${hasLink ? 'SI' : 'NO'} | Error: ${m.error || 'Ninguno'}\n`;
      output += `  Mensaje: ${m.mensaje.substring(0, 150)}...\n`;
      output += '---\n';
    });
  }
  
  fs.writeFileSync('debug_final.txt', output, 'utf8');
  console.log('Results saved to debug_final.txt');
}

checkDebug();
