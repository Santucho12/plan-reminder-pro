require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: all, error } = await supabase
    .from('messages_log')
    .select('id, tipo, mensaje, enviado, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) { console.error('Error al buscar:', error.message); return; }

  console.log('=== ÚLTIMOS 30 MENSAJES ===');
  all.forEach(m => {
    const tieneLink = m.mensaje.includes('https://');
    const fecha = (m.created_at || '').substring(0, 16);
    const estado = m.enviado ? 'ENVIADO  ' : 'PENDIENTE';
    console.log(`[${estado}] ${m.tipo.padEnd(12)} | Link: ${tieneLink ? 'SI' : 'NO'} | ${fecha}`);
  });

  const pendientesSinLink = all.filter(m => !m.enviado && !m.mensaje.includes('https://'));
  const todosSinLink = all.filter(m => !m.mensaje.includes('https://'));

  console.log('\n=== RESUMEN ===');
  console.log('Total mensajes revisados:', all.length);
  console.log('Pendientes SIN link (a borrar):', pendientesSinLink.length);
  console.log('Total sin link (enviados + pendientes):', todosSinLink.length);

  if (pendientesSinLink.length === 0) {
    console.log('\nNo hay mensajes PENDIENTES sin link. Nada que borrar.');
    console.log('Los que ya fueron enviados no se pueden recuperar.');
    console.log('\nPara generar nuevos mensajes CON link, presioná el boton de recordatorios en la app.');
    return;
  }

  console.log('\nBorrando', pendientesSinLink.length, 'mensajes pendientes sin link...');
  const ids = pendientesSinLink.map(m => m.id);
  const { error: delErr } = await supabase
    .from('messages_log')
    .delete()
    .in('id', ids);

  if (delErr) {
    console.error('Error al borrar:', delErr.message);
  } else {
    console.log('EXITO: Borrados', ids.length, 'mensajes.');
    console.log('Ahora presiona el boton de recordatorios en la app para regenerarlos CON link.');
  }
}

main();
