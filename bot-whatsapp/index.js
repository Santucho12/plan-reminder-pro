require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// Health Check Server for Deployment
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
}).listen(PORT, () => {
    console.log(`Salud check server corriendo en puerto ${PORT}`);
});

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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/nicaelacode/nicaela/master/nicaela/nicaela.json',
    }
});

client.on('auth_failure', msg => {
    console.error('Error de autenticación:', msg);
});

client.on('authenticated', () => {
    console.log('--- AUTENTICACIÓN EXITOSA ---');
});

let qrUploaded = false;

client.on('qr', async (qr) => {
    if (qrUploaded) {
        console.log('QR regenerado (ignorado, ya se subió uno válido).');
        return;
    }
    
    console.log('--- NUEVO QR GENERADO ---');
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
        console.log('QR subido a Supabase con éxito. Escanealo desde la web.');
        qrUploaded = true;
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

client.on('auth_failure', (msg) => {
    console.error('Bot de WhatsApp - Error de autenticación:', msg);
});

client.on('error', (err) => {
    console.error('Bot de WhatsApp - Error crítico detectado:', err.message);
    // Intentar no re-iniciar si es algo no crítico, o avisar en Supabase.
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

                // Validación básica de teléfono (mínimo 8 dígitos para un número real)
                if (phone.replace(/[^0-9]/g, '').length < 8) {
                    console.log(`Mensaje ${msg.id} tiene un teléfono inválido o muy corto (${phone}). Marcamos como error.`);
                    await supabase.from('messages_log').update({ enviado: true, error: 'Número inválido' }).eq('id', msg.id);
                    continue;
                }

                const formattedPhone = phone.includes('@c.us') ? phone : `${phone}@c.us`;

                try {
                    console.log(`Enviando mensaje a ${formattedPhone}...`);
                    console.log(`Contenido: "${msg.mensaje.substring(0, 50)}..."`);
                    await client.sendMessage(formattedPhone, msg.mensaje);
                    
                    await supabase
                        .from('messages_log')
                        .update({ enviado: true, error: null })
                        .eq('id', msg.id);
                    
                    console.log(`Mensaje ${msg.id} enviado con éxito.`);
                } catch (sendError) {
                    const errorMsg = sendError.message || String(sendError);
                    console.error(`Error enviando mensaje ${msg.id}:`, errorMsg);
                    
                    // Si el error es de "detached Frame", NO lo marcamos como enviado = true. 
                    // Lo dejamos en false para que el bot lo intente de nuevo en el próximo ciclo cuando Puppeteer se estabilice.
                    const isTemporallyError = errorMsg.includes('detached Frame');
                    
                    await supabase
                        .from('messages_log')
                        .update({ 
                            enviado: !isTemporallyError, // Solo marcamos enviado true si NO es un error temporal
                            error: errorMsg 
                        })
                        .eq('id', msg.id);
                        
                    if (isTemporallyError) {
                        console.log('⚠️ Error temporal detectado (Detached Frame). El mensaje será reintentado.');
                        // Opcional: Si el error persiste demasiado, obligar a un reinicio
                        // process.exit(1); 
                    }
                }
            }
        } catch (err) {
            console.error('Error en el ciclo de polling:', err.message);
            if (err.message.includes('detached Frame')) {
                console.error('❌ Error fatal de Puppeteer. Reiniciá el bot manualmente.');
                process.exit(1); 
            }
        }
    }, 20000); 
}

async function initializeWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Intento de inicialización ${attempt}/${maxRetries}...`);
            await client.initialize();
            return; // Success
        } catch (err) {
            console.error(`Error al inicializar el cliente (intento ${attempt}/${maxRetries}):`, err.message);
            // Intentar cerrar el navegador para limpiar el estado
            try { await client.destroy(); } catch (_) {}
            if (attempt < maxRetries) {
                const waitSec = attempt * 5;
                console.log(`Reintentando en ${waitSec} segundos...`);
                await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
            } else {
                console.error('Se agotaron todos los intentos de inicialización.');
                process.exit(1);
            }
        }
    }
}

initializeWithRetry();
