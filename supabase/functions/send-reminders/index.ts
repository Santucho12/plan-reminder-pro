import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      throw new Error('userId is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    // Find clients whose plan expires in exactly 3 days (reminder)
    // Filter by userId and exclude only those explicitly marked as 'pagado'
    const { data: reminders, error: remErr } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .eq('vencimiento', threeDaysStr)
      .neq('estado', 'pagado');

    if (remErr) throw remErr;

    // Find clients whose plan expired today (vencimiento)
    const { data: expired, error: expErr } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .eq('vencimiento', todayStr)
      .neq('estado', 'pagado');

    if (expErr) throw expErr;

    // Find clients whose plan already expired (update estado)
    const { data: overdue } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .lt('vencimiento', todayStr)
      .neq('estado', 'vencido');

    // Update overdue clients
    if (overdue && overdue.length > 0) {
      const overdueIds = overdue.map(c => c.id);
      await supabase
        .from('clients')
        .update({ estado: 'vencido' })
        .in('id', overdueIds);
    }

    const results = { reminders_sent: 0, expiry_sent: 0, errors: [] as string[] };

    // Process 3-day reminders
    if (reminders) {
      for (const client of reminders) {
        const mensaje = `Hola ${client.nombre}, como estás? te recordamos que tu plan *${client.plan}* va a vencer en 3 días. El total es *$${client.total}*.\n\n¡Que tengas un buen día! 💪`;
        
        await supabase.from('messages_log').insert({
          client_id: client.id,
          user_id: client.user_id,
          tipo: 'recordatorio',
          mensaje,
          enviado: false,
        });
        
        results.reminders_sent++;
      }
    }

    // Process expiration day messages
    if (expired) {
      for (const client of expired) {
        // Update estado to vencido
        await supabase
          .from('clients')
          .update({ estado: 'vencido' })
          .eq('id', client.id);

        const mensaje = `Hola ${client.nombre}, tu plan *${client.plan}* venció hoy. El total es *$${client.total}*.\n\nTe mando el link de pago: 🔗 [Link Mercado Pago]\n\n¡Gracias!`;
        
        await supabase.from('messages_log').insert({
          client_id: client.id,
          user_id: client.user_id,
          tipo: 'vencimiento',
          mensaje,
          enviado: false,
        });
        
        results.expiry_sent++;
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
