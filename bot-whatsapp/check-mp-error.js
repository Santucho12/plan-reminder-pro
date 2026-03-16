require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('messages_log')
    .select('id, tipo, mensaje, error, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) { console.error('Error al buscar:', error.message); return; }

  console.log('=== ÚLTIMOS 5 MENSAJES ENVIADOS (DE LA AUTOMATIZACIÓN) ===');
  data.forEach(m => {
    const tieneLink = m.mensaje.includes('https://');
    const fecha = (m.created_at || '').substring(0, 16);
    console.log(`\n[${fecha}] Tipo: ${m.tipo.padEnd(12)} | Link: ${tieneLink ? 'SI' : 'NO'}`);
    if (m.error) {
       console.log(`   🚨 ERROR MP: ${m.error}`);
    } else {
       console.log(`   ✅ Sin errores MP en BD.`);
    }
  });
}

main();
