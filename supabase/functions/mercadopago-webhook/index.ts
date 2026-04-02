import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MP_BASE_URL = 'https://api.mercadopago.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    // Buscamos todos los user_configs que tengan token configurado
    const { data: configs } = await supabase
      .from('user_configs')
      .select('user_id, mp_access_token')
      .not('mp_access_token', 'is', null);

    let paymentInfo = null;
    let matchedConfig = null;

    // Intentar verificar el pago con cada token hasta encontrar uno que funcione
    if (configs) {
      for (const config of configs) {
        const token = String(config.mp_access_token).trim();
        try {
          const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (res.ok) {
            paymentInfo = await res.json();
            matchedConfig = config;
            console.log(`Pago ${paymentId} verificado con token de usuario ${config.user_id}`);
            break;
          }
        } catch (err) {
          console.error(`Error verificando con token ${config.user_id}:`, err);
          continue;
        }
      }
    }

    if (!paymentInfo) {
      console.error(`No se pudo verificar el pago ${paymentId} con ningún token`);
      return new Response(JSON.stringify({ error: 'Could not verify payment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // LÓGICA DE VENCIMIENTO: UTC-3 (Hora Argentina)
    const currentExpiry = client.vencimiento ? new Date(`${client.vencimiento}T00:00:00Z`) : new Date();
    const nowUtc = new Date();
    const today = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    today.setUTCHours(0, 0, 0, 0); // Para poder comparar
    
    let baseDate = currentExpiry > today ? currentExpiry : today;
    const newVencimiento = new Date(baseDate);
    newVencimiento.setMonth(newVencimiento.getMonth() + 1);

    const newExpiryStr = newVencimiento.toISOString().split('T')[0];

    // Actualizar cliente: estado PAGADO, nueva fecha de vencimiento
    const { error: updateErr } = await supabase
      .from('clients')
      .update({
        estado: 'PAGADO',
        vencimiento: newExpiryStr,
        mercadopago_preference_id: null, // Limpiar preferencia usada
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

    console.log(`✅ Pago ${paymentId} procesado exitosamente para ${client.nombre}`);

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
      status: 200, // Devolvemos 200 para que MP deje de reintentar si es un error lógico nuestro
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
