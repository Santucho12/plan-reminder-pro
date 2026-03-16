require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APP_URL = 'https://plan-reminder-pro.vercel.app';
const MP_BASE_URL = 'https://api.mercadopago.com';

async function createMPPreference(client, mpToken) {
  const webhookUrl = `${process.env.SUPABASE_URL}/functions/v1/mercadopago-webhook`;
  const cleanTitle = `Plan ${client.plan || 'Mensual'}`.replace(/[^\w\s]/gi, '').substring(0, 30);
  const cleanName = client.nombre.replace(/[^\w\s]/gi, '').substring(0, 30);

  const preference = {
    items: [{
      id: client.id,
      title: cleanTitle,
      description: `Servicio ${cleanTitle}`.substring(0, 60),
      quantity: 1,
      currency_id: 'ARS',
      unit_price: Math.round(Number(client.total) * 100) / 100,
    }],
    payer: { email: 'pago.cliente@gmail.com', name: cleanName },
    external_reference: client.id,
    back_urls: {
      success: `${APP_URL}/`,
      failure: `${APP_URL}/`,
      pending: `${APP_URL}/`,
    },
    notification_url: webhookUrl,
    auto_return: 'approved',
    statement_descriptor: 'FIESTACR',
  };

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mpToken}`,
    },
    body: JSON.stringify(preference),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`MP Error ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('=== TEST END-TO-END: Link de pago + Envío por WhatsApp ===\n');

  // 1. Obtener token de MP
  const { data: configRows } = await supabase
    .from('user_configs')
    .select('mp_access_token, user_id')
    .limit(1);

  const config = configRows?.[0];
  if (!config?.mp_access_token) {
    console.error('ERROR: No se encontró mp_access_token en user_configs');
    return;
  }
  const mpToken = config.mp_access_token.trim();
  const userId = process.env.USER_ID;
  console.log('✅ Token MP encontrado');
  console.log('✅ User ID:', userId);

  // 2. Tomar el primer cliente con total > 0
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .gt('total', 0)
    .limit(5);

  if (!clients || clients.length === 0) {
    console.error('ERROR: No se encontraron clientes con total > 0');
    return;
  }

  const client = clients[0];
  console.log(`\n📋 Cliente de prueba: ${client.nombre} | Plan: ${client.plan} | Total: $${client.total} | Tel: ${client.celular}`);

  // 3. Crear preferencia de MP
  console.log('\n🔄 Creando preferencia de pago en MercadoPago...');
  let linkPago = '';
  try {
    const mpPref = await createMPPreference(client, mpToken);
    linkPago = mpPref.init_point;
    console.log('✅ Preferencia creada exitosamente!');
    console.log('   Preference ID:', mpPref.id);
    console.log('   Link de pago:', linkPago);
  } catch (e) {
    console.error('❌ Error creando preferencia MP:', e.message);
    return;
  }

  // 4. Armar el mensaje con el link
  const mensaje = `Hola ${client.nombre}, como estás? te recordamos que tu plan *${client.plan}* está próximo a vencer. El total es *$${client.total}*.\n\nPodes ir pagando desde acá para renovar:\n🔗 ${linkPago}\n\n¡Que tengas un buen día! 💪`;

  console.log('\n📨 Mensaje que se va a enviar:');
  console.log('---');
  console.log(mensaje);
  console.log('---');

  // 5. Insertar en messages_log para que el bot lo envíe
  const { error: insertErr } = await supabase
    .from('messages_log')
    .insert({
      client_id: client.id,
      user_id: userId,
      tipo: 'recordatorio',
      mensaje,
      enviado: false,
      error: null,
    });

  if (insertErr) {
    console.error('\n❌ Error al insertar en messages_log:', insertErr.message);
    return;
  }

  console.log('\n✅ Mensaje insertado en messages_log exitosamente!');
  console.log('⏳ El bot lo va a enviar en los próximos 20 segundos...');
  console.log(`📱 Destino: ${client.celular}`);
}

main();
