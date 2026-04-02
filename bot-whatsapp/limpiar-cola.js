require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = "9732679a-ab89-4f99-bc40-4089e69d8b71";

const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
    console.log('--- EMPEZANDO LIMPIEZA DE COLA ---');
    const { error, count } = await supabase
        .from('messages_log')
        .update({ enviado: true, error: 'Cancelado por exceso' })
        .eq('enviado', false)
        .eq('user_id', userId);

    if (error) {
        console.error('Error limpiando:', error.message);
    } else {
        console.log(`✅ ¡Limpieza exitosa! Se cancelaron todos los mensajes pendientes.`);
    }
    process.exit(0);
}

clean();
