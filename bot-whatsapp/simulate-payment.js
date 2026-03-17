require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = '00000000-0000-0000-0000-000000000000';

async function simulateFlow() {
  console.log('--- INICIANDO SIMULACIÓN DE PAGO ---');
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // 1. Limpiar simulaciones anteriores (opcional pero recomendado)
  await supabase.from('clients').delete().eq('nombre', 'CLIENTE SIMULADO');

  // 2. Crear Cliente
  const clientId = require('crypto').randomUUID();
  const clientData = {
    id: clientId,
    user_id: userId,
    nombre: 'CLIENTE SIMULADO',
    apellido: 'PAGO TEST',
    celular: '5492911234567',
    plan: 'Plan Premium',
    total: 8000,
    vencimiento: todayStr,
    estado: 'Vence hoy',
    dias: 0
  };

  console.log('Insertando cliente...');
  const { data: insertedData, error: clientError } = await supabase
    .from('clients')
    .insert([clientData])
    .select();

  if (clientError) {
    console.error('Error insertando:', clientError);
    return;
  }

  const client = insertedData[0];
  console.log(`✅ Cliente creado: ${client.nombre} (ID: ${client.id})`);

  // 3. Simular envío de recordatorio
  const linkPagoSimulado = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=simulated_${client.id}`;
  const reminderMsg = `Hola ${client.nombre}, tu plan ${client.plan} venció hoy. El total es $${client.total}. Podes pagar desde este link: \n🔗 ${linkPagoSimulado}\n¡Gracias!`;
  
  await supabase.from('messages_log').insert({
    client_id: client.id,
    user_id: userId,
    tipo: 'vencimiento',
    mensaje: reminderMsg,
    enviado: true
  });
  console.log('✅ Recordatorio enviado.');

  console.log('Simulando procesamiento de pago (2 segundos)...');
  await new Promise(r => setTimeout(r, 2000));

  // 4. Actualizar como si el Webhook lo hubiera hecho
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  const { error: updateError } = await supabase
    .from('clients')
    .update({
      estado: 'PAGADO',
      vencimiento: nextMonthStr
    })
    .eq('id', client.id);

  if (updateError) {
    console.error('Error al actualizar:', updateError);
    return;
  }
  
  console.log(`✅ PAGO CONFIRMADO. Estado: PAGADO. Próximo Vencimiento: ${nextMonthStr}`);

  // 5. Log de confirmación
  await supabase.from('messages_log').insert({
    client_id: client.id,
    user_id: userId,
    tipo: 'pago_confirmado',
    mensaje: `✅ Pago Recibido ($8000) de ${client.nombre}. Renovado hasta el ${nextMonthStr}`,
    enviado: true
  });

  console.log('--- SIMULACIÓN FINALIZADA ---');
}

simulateFlow();
