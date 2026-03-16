require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Se recomienda Service Role para este bot worker

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios en el .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ID del usuario que este bot va a manejar
const userId = process.env.USER_ID;

if (!userId) {
    console.error('Error: USER_ID es obligatorio en el .env');
    process.exit(1);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('auth_failure', msg => {
    console.error('Error de autenticación:', msg);
});

client.on('authenticated', () => {
    console.log('--- AUTENTICACIÓN EXITOSA ---');
});

client.on('qr', async (qr) => {
    console.log('--- NUEVO QR GENERADO ---');
    // Subir QR a Supabase para que el usuario lo vea en la web
    const { error } = await supabase
        .from('user_configs')
        .update({ 
            wpp_qr_code: qr, 
            wpp_status: 'pending_qr' 
        })
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error al subir QR a Supabase:', error.message);
    } else {
        console.log('QR subido a Supabase con éxito.');
    }
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp - Evento READY disparado.');
    
    // Actualizar estado en Supabase
    const { error } = await supabase
        .from('user_configs')
        .update({ 
            wpp_status: 'connected',
            wpp_qr_code: null
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error al actualizar estado a connected en Supabase:', error.message);
    } else {
        console.log('Estado actualizado a CONNECTED en Supabase.');
    }

    console.log('Iniciando ciclo de procesamiento de mensajes...');
    startPolling();
});

client.on('disconnected', async () => {
    console.log('WhatsApp desconectado.');
    await supabase
        .from('user_configs')
        .update({ wpp_status: 'disconnected' })
        .eq('user_id', userId);
});

async function startPolling() {
    // Polling cada 20 segundos (para cumplir con la meta de 3 mensajes por minuto)
    setInterval(async () => {
        try {
            // Buscamos 1 mensaje no enviado a la vez de ESTE usuario
            // Los links de MP ya vienen incluidos en el mensaje desde send-reminders
            const { data: messages, error } = await supabase
                .from('messages_log')
                .select('*, clients(celular)')
                .eq('user_id', userId)
                .eq('enviado', false)
                .order('created_at', { ascending: true })
                .limit(1); 

            if (error) throw error;

            for (const msg of messages) {
                const phone = msg.clients?.celular;
                if (!phone) {
                    console.log(`Mensaje ${msg.id} no tiene teléfono asociado. Saltando...`);
                    await supabase.from('messages_log').update({ enviado: true, error: 'No phone' }).eq('id', msg.id);
                    continue;
                }

                const formattedPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;

                try {
                    console.log(`Enviando mensaje a ${formattedPhone}...`);
                    await client.sendMessage(formattedPhone, msg.mensaje);
                    
                    await supabase
                        .from('messages_log')
                        .update({ enviado: true, error: null })
                        .eq('id', msg.id);
                    
                    console.log(`Mensaje ${msg.id} enviado con éxito.`);
                } catch (sendError) {
                    console.error(`Error enviando mensaje ${msg.id}:`, sendError);
                    // Marcamos "enviado: true" pero dejamos el error grabado para que el bot no se quede trabado infinitamente reintentando con este mismo mensaje defectuoso
                    await supabase
                        .from('messages_log')
                        .update({ enviado: true, error: sendError.message })
                        .eq('id', msg.id);
                }
            }
        } catch (err) {
            console.error('Error en el ciclo de polling:', err.message);
        }
    }, 20000); 
}

client.initialize().catch(err => {
    console.error('Error al inicializar el cliente:', err);
});
