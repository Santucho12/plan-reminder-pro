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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    
    // Mercado Pago sends webhook with payment info
    const { type, data } = body;

    if (type !== 'payment') {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // In production, you'd verify the payment with MP API
    // For now, we look for the client by preference_id
    const paymentId = data?.id;
    const externalReference = body?.external_reference; // client_id stored as external_reference

    if (!externalReference) {
      return new Response(JSON.stringify({ error: 'Missing external_reference' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', externalReference)
      .single();

    if (clientErr || !client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate new expiration date: 1 month from today
    const newVencimiento = new Date();
    newVencimiento.setMonth(newVencimiento.getMonth() + 1);

    // Update client: set estado to pagado, update vencimiento
    const { error: updateErr } = await supabase
      .from('clients')
      .update({
        estado: 'pagado',
        vencimiento: newVencimiento.toISOString().split('T')[0],
      })
      .eq('id', client.id);

    if (updateErr) {
      throw new Error(`Failed to update client: ${updateErr.message}`);
    }

    // Log the payment confirmation
    await supabase.from('messages_log').insert({
      client_id: client.id,
      user_id: client.user_id,
      tipo: 'pago_confirmado',
      mensaje: `Pago recibido de ${client.nombre} ${client.apellido}. Nueva fecha de vencimiento: ${newVencimiento.toISOString().split('T')[0]}`,
      enviado: true,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      client_id: client.id,
      new_vencimiento: newVencimiento.toISOString().split('T')[0],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in mercadopago-webhook:', errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
