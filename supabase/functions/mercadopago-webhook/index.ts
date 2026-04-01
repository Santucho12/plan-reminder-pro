import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MP_BASE_URL = 'https://api.mercadopago.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook MP Recibido:', JSON.stringify(body));
    
    // MP puede enviar notificaciones de tipo 'payment' (Webhooks) o 'topic: payment' (IPN)
    const type = body.type || body.topic;
    const paymentId = body.data?.id || body.id;

    if (type !== 'payment') {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!paymentId) {
      console.error('Falta ID de pago en notificación');
      return new Response(JSON.stringify({ error: 'Missing payment id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!mpToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN no configurado');
      return new Response(JSON.stringify({ error: 'MP token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar el pago con la API de Mercado Pago
    const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken.trim()}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error verificando pago ${paymentId}: ${res.status} - ${errText}`);
      return new Response(JSON.stringify({ error: 'Could not verify payment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentInfo = await res.json();
    console.log(`Pago ${paymentId} verificado. Estado: ${paymentInfo.status}, external_reference: ${paymentInfo.external_reference}`);

    // Verificar que el pago fue aprobado
    if (paymentInfo.status !== 'approved') {
      console.log(`Pago ${paymentId} tiene estado: ${paymentInfo.status}. Ignorando.`);
      return new Response(JSON.stringify({ received: true, status: paymentInfo.status, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener el client_id desde external_reference del pago verificado
    const clientId = paymentInfo.external_reference;

    if (!clientId) {
      console.error(`Pago ${paymentId} no tiene external_reference`);
      return new Response(JSON.stringify({ error: 'Missing external_reference in payment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar el cliente
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      console.error(`Cliente ID ${clientId} no encontrado para pago ${paymentId}`);
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Nueva fecha de vencimiento: 1 mes desde HOY
    const today = new Date();
    const newVencimiento = new Date(today);
    newVencimiento.setMonth(newVencimiento.getMonth() + 1);
    const newExpiryStr = newVencimiento.toISOString().split('T')[0];

    // Actualizar cliente: estado activo, nueva fecha de vencimiento
    const { error: updateErr } = await supabase
      .from('clients')
      .update({
        estado: 'activo',
        vencimiento: newExpiryStr,
        mercadopago_preference_id: null,
      })
      .eq('id', client.id);

    if (updateErr) {
      throw new Error(`Failed to update client: ${updateErr.message}`);
    }

    // Registrar confirmación de pago en el log
    await supabase.from('messages_log').insert({
      client_id: client.id,
      user_id: client.user_id,
      tipo: 'pago_confirmado',
      mensaje: `✅ Pago Recibido ($${paymentInfo.transaction_amount}) de ${client.nombre}. Nuevo vencimiento: ${newExpiryStr}`,
      enviado: true,
    });

    console.log(`✅ Pago ${paymentId} procesado exitosamente para ${client.nombre}. Nuevo vencimiento: ${newExpiryStr}`);

    return new Response(JSON.stringify({ 
      success: true, 
      client: client.nombre,
      new_vencimiento: newExpiryStr,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error crítico en mercadopago-webhook:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
