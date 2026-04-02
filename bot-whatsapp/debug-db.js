require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = process.env.USER_ID;

async function checkDebug() {
  console.log('--- CHECKING CONFIG ---');
  const { data: config, error: configError } = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (configError) console.error('Config Error:', configError.message);
  else {
    console.log('MP Token exists:', !!config?.mp_access_token);
    console.log('MP Token Value:', config?.mp_access_token ? config.mp_access_token.substring(0, 15) + '...' : 'NULL');
  }

  console.log('\n--- CHECKING RECENT MESSAGES ---');
  const { data: messages, error: msgError } = await supabase
    .from('messages_log')
    .select('id, tipo, error, created_at, mensaje')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgError) console.error('Msg Error:', msgError.message);
  else {
    messages.forEach(m => {
      const hasLink = m.mensaje.includes('mercadopago.com') || m.mensaje.includes('init_point');
      console.log(`- ID: ${m.id.substring(0,8)} | Tipo: ${m.tipo} | Link: ${hasLink ? 'SI' : 'NO'} | Error: ${m.error || 'Ninguno'}`);
      if (!hasLink && !m.error) {
          console.log(`  Mensaje: ${m.mensaje.replace(/\n/g, ' ')}`);
      }
    });
  }
}

checkDebug();
