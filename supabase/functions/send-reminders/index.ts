import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MP_BASE_URL = 'https://api.mercadopago.com';

async function createMPPreference(client: any, mpToken: string, webhookUrl: string, appUrl: string) {
  // Limpiar título de caracteres especiales que puedan molestar a MP
  const cleanTitle = `Plan ${client.plan || 'Mensual'}`.replace(/[^\w\s]/gi, '').substring(0, 30);
  const cleanName = client.nombre.replace(/[^\w\s]/gi, '').substring(0, 30);

  const preference = {
    items: [
      {
        id: client.id,
        title: cleanTitle,
        description: `Servicio ${cleanTitle}`.substring(0, 60),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Math.round(Number(client.total) * 100) / 100,
      }
    ],
    payer: {
      email: 'pago.servicios@gmail.com', // use a more generic neutral email if required
    },
    external_reference: client.id,
    back_urls: {
      success: `${appUrl}/`,
      failure: `${appUrl}/`,
      pending: `${appUrl}/`,
    },
    notification_url: webhookUrl,
    auto_return: 'approved',
  };

  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mpToken}`,
    },
    body: JSON.stringify(preference),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[MP ERROR] Status ${res.status}:`, errorBody);
    throw new Error(`MP Error ${res.status}: ${errorBody}`);
  }

  const data = await res.json();
  console.log(`[MP SUCCESS] Preference ${data.id} created. Link: ${data.init_point}`);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, origin, mode = 'regular' } = await req.json();
    if (!userId) {
      throw new Error('userId is required');
    }

    // Fuerza siempre la URL de producción para MercadoPago en back_urls
    const appUrl = 'https://plan-reminder-pro.vercel.app';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener config del usuario (token de MP)
    const { data: userConfig } = await supabase
      .from('user_configs')
      .select('mp_access_token')
      .eq('user_id', userId)
      .single();

    const mpToken = userConfig?.mp_access_token;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    console.log(`[DEBUG] userId: ${userId}`);
    console.log(`[DEBUG] Config found: ${!!userConfig}`);
    console.log(`[DEBUG] Token found: ${!!mpToken}`);
    console.log(`[DEBUG] Mode: ${mode}`);

    // Obtener todos los clientes activos del usuario
    const { data: allClients, error: fetchErr } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .neq('estado', 'PAGADO')
      .neq('estado', 'pagado');

    if (fetchErr) throw fetchErr;

    // Obtener mensajes ya enviados en el ÚLTIMO MINUTO para evitar doble click accidental
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentMessages } = await supabase
      .from('messages_log')
      .select('client_id, tipo')
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo);

    const alreadySentSet = new Set(
      (recentMessages || []).map(m => `${m.client_id}::${m.tipo}`)
    );

    const sentPhones = new Set(); // Para evitar duplicar por celular en esta misma ejecución

    const regularReminders = [];
    const regularExpirations = [];
    const expiredClients = [];
    const lostClients = [];

    // Calcular dias DINÁMICAMENTE desde la fecha de vencimiento
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const client of allClients || []) {
      if (!client.vencimiento) continue;

      // Usamos el mismo método que el frontend para calcular la diferencia de días
      const vencDate = new Date(`${client.vencimiento}T00:00:00`);
      const diffTime = vencDate.getTime() - today.getTime();
      const diasNum = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (mode === 'lost') {
        if (diasNum <= -31) {
          lostClients.push(client);
        }
      } else if (mode === 'expired') {
        if (diasNum <= -1 && diasNum >= -30) {
          expiredClients.push(client);
        }
      } else {
        // Modo Regular
        if (diasNum >= 1 && diasNum <= 3) {
          regularReminders.push({ ...client, diasNumCalculated: diasNum });
        } else if (diasNum === 0) {
          regularExpirations.push({ ...client, diasNumCalculated: diasNum });
        }
      }
    }

    const results = { reminders_sent: 0, expiry_sent: 0, expired_sent: 0, lost_sent: 0, skipped: 0, errors: [] as string[] };

    // 1. Procesar Modo Regular
    if (mode === 'regular') {
      for (const client of regularReminders) {
        if (alreadySentSet.has(`${client.id}::recordatorio`)) { results.skipped++; continue; }
        if (sentPhones.has(client.celular)) { results.skipped++; continue; }

        let linkPago = '';
        let mpErrorDetail = null;
        if (mpToken && Number(client.total) > 0) {
          try {
            const mpPreference = await createMPPreference(client, mpToken.trim(), webhookUrl, appUrl);
            linkPago = mpPreference.init_point;
            await supabase.from('clients').update({ mercadopago_preference_id: mpPreference.id }).eq('id', client.id);
          } catch (e: any) {
            mpErrorDetail = e.message || String(e);
            results.errors.push(`MP Error para ${client.nombre}: ${mpErrorDetail}`);
          }
        }

        const diasNum = (client as any).diasNumCalculated;
        const diasTexto = diasNum === 1 ? 'mañana' : `en ${diasNum} días`;
        const linkTexto = linkPago ? `\n\nPodes ir pagando desde acá para renovar:\n🔗 ${linkPago}` : '';
        const mensaje = `Hola ${client.nombre}, como estás? te recordamos que tu plan *${client.plan}* va a vencer ${diasTexto}. El total es *$${client.total}*.${linkTexto}\n\n¡Que tengas un buen día! 💪`;

        await supabase.from('messages_log').insert({
          client_id: client.id, user_id: client.user_id, tipo: 'recordatorio', mensaje, enviado: false, error: mpErrorDetail,
        });
        sentPhones.add(client.celular);
        results.reminders_sent++;
      }

      const debugTokens: any[] = [];

      for (const client of regularExpirations) {
        if (alreadySentSet.has(`${client.id}::vencimiento`)) { results.skipped++; continue; }
        if (sentPhones.has(client.celular)) { results.skipped++; continue; }

        let linkPago = '';
        let mpErrorDetail = null;
        let tryingMP = false;

        if (mpToken && Number(client.total) > 0) {
          tryingMP = true;
          const cleanToken = mpToken.trim();
          try {
            const mpPreference = await createMPPreference(client, cleanToken, webhookUrl, appUrl);
            linkPago = mpPreference.init_point || '';
            await supabase.from('clients').update({ mercadopago_preference_id: mpPreference.id }).eq('id', client.id);
          } catch (e: any) {
            mpErrorDetail = e.message || String(e);
            results.errors.push(`MP Error para ${client.nombre}: ${mpErrorDetail}`);
          }
        }

        debugTokens.push({
          cliente: client.nombre,
          total: client.total,
          mpTokenExists: !!mpToken,
          tryingMP,
          linkPagoLength: linkPago.length,
          errorDetalle: mpErrorDetail
        });

        const linkTexto = linkPago ? `\n\nPodés pagar desde este link:\n🔗 ${linkPago}` : '\n\n_Contactate con nosotros para regularizar tu situación._';
        const mensaje = `Hola ${client.nombre}, tu plan *${client.plan}* venció hoy. El total es *$${client.total}*.${linkTexto}\n\n¡Gracias!`;
        await supabase.from('messages_log').insert({
          client_id: client.id, user_id: client.user_id, tipo: 'vencimiento', mensaje, enviado: false, error: mpErrorDetail,
        });
        sentPhones.add(client.celular);
        results.expiry_sent++;
      }

    }
    // 2. Procesar Modo Expired (-1 a -30 días)
    else if (mode === 'expired') {
      for (const client of expiredClients) {
        if (alreadySentSet.has(`${client.id}::vencimiento`)) { results.skipped++; continue; }
        if (sentPhones.has(client.celular)) { results.skipped++; continue; }

        let linkPago = '';
        let mpErrorDetail = null;
        if (mpToken && Number(client.total) > 0) {
          try {
            const mpPreference = await createMPPreference(client, mpToken.trim(), webhookUrl, appUrl);
            linkPago = mpPreference.init_point;
            await supabase.from('clients').update({ mercadopago_preference_id: mpPreference.id }).eq('id', client.id);
          } catch (e: any) {
            mpErrorDetail = e.message || String(e);
            results.errors.push(`MP Error para ${client.nombre}: ${mpErrorDetail}`);
          }
        }
        const linkTexto = linkPago ? `\n\nTe mando el link de pago: 🔗 ${linkPago}` : '';
        const mensaje = `Hola ${client.nombre}, notamos que tu plan *${client.plan}* ya se encuentra vencido. El total para renovarlo es *$${client.total}*.${linkTexto}\n\n¡Gracias!`;
        await supabase.from('messages_log').insert({
          client_id: client.id, user_id: client.user_id, tipo: 'vencimiento', mensaje, enviado: false, error: mpErrorDetail,
        });
        sentPhones.add(client.celular);
        results.expired_sent++;
      }
    }
    // 3. Procesar Modo Lost (<= -31 días)
    else if (mode === 'lost') {
      for (const client of lostClients) {
        if (alreadySentSet.has(`${client.id}::vencimiento`)) { results.skipped++; continue; }
        if (sentPhones.has(client.celular)) { results.skipped++; continue; }

        let linkPago = '';
        let mpErrorDetail = null;
        if (mpToken && Number(client.total) > 0) {
          try {
            const mpPreference = await createMPPreference(client, mpToken.trim(), webhookUrl, appUrl);
            linkPago = mpPreference.init_point;
            await supabase.from('clients').update({ mercadopago_preference_id: mpPreference.id }).eq('id', client.id);
          } catch (e: any) {
            mpErrorDetail = e.message || String(e);
            results.errors.push(`MP Error para ${client.nombre}: ${mpErrorDetail}`);
          }
        }
        const linkTexto = linkPago ? `\n\nTe mando el link de pago: 🔗 ${linkPago}` : '';
        const mensaje = `Hola ${client.nombre}, notamos que hace un tiempo tu plan *${client.plan}* se encuentra vencido. El total para renovarlo es *$${client.total}*.\n\n¿Te gustaría renovarlo?${linkTexto}`;
        await supabase.from('messages_log').insert({
          client_id: client.id, user_id: client.user_id, tipo: 'vencimiento', mensaje, enviado: false, error: mpErrorDetail,
        });
        sentPhones.add(client.celular);
        results.lost_sent++;
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-reminders:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
