require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

if (process.env.ALLOW_INSECURE_TLS === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn('⚠️ TLS verification disabled (ALLOW_INSECURE_TLS=true). Use only for local troubleshooting.');
}

// Health Check Server for Deployment
const PORT = process.env.PORT || 3000;
const healthServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
});

healthServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.warn(`Puerto ${PORT} ocupado: se omite health-check, el bot continúa.`);
        return;
    }
    console.error('Error en health-check server:', err.message || String(err));
});

healthServer.listen(PORT, () => {
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
const DEFAULT_PAYMENT_ALIAS = 'Santi.abenel';
const DEFAULT_PAYMENT_CBU = '0000003100092533873855';

// Vencidos entre 1 y 30 días (pestaña "Vencidos")
const MSG_EXPIRED_1_30 = `Hola 
Tú suscripción ya está vencida ⚠️

Vimos que aún no abonaste tu servicio, vas a querer renovar o procedemos con la baja? ❌

Muchas gracias!`;

// Vencidos hace más de 30 días (pestaña "Recuperación")
const MSG_LOST_OVER_30 = `Hola 👋🏼
Notamos que no renovas tu suscripción hace un tiempo⚠️
Te ofrecemos la oportunidad de reincorporarte con un 10% de descuento en cualquier plataforma que elijas 😁`;

// ID del usuario que este bot va a manejar
const userId = process.env.USER_ID;

if (!userId) {
    console.error('Error: USER_ID es obligatorio en el .env');
    process.exit(1);
}

console.log(`Supabase: ${supabaseUrl}`);
console.log(`USER_ID bot: ${userId}`);

async function setBotPresence(status, extra = {}) {
    const { error } = await supabase
        .from('user_configs')
        .update({ wpp_status: status, ...extra })
        .eq('user_id', userId);
    if (error) {
        console.error(`No se pudo actualizar wpp_status=${status}:`, error.message);
    }
}

// Al iniciar, no dejar "connected" viejo en la web si el bot todavía no está listo
setBotPresence('connecting', { wpp_last_heartbeat: null }).catch(() => {});

const client = new Client({
    authStrategy: new LocalAuth(),
    authTimeoutMs: 120000,
    qrMaxRetries: 10,
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        // En Windows, menos flags = más estable (evita "Execution context was destroyed")
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

client.on('auth_failure', msg => {
    console.error('Error de autenticación:', msg);
});

client.on('authenticated', async () => {
    console.log('--- AUTENTICACIÓN EXITOSA ---');
    console.log('Esperando evento READY (ahí recién queda listo para enviar)...');
    await setBotPresence('connecting');
});

let qrUploaded = false;

async function uploadQrToSupabase(qr, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const { error } = await supabase
            .from('user_configs')
            .update({
                wpp_qr_code: qr,
                wpp_status: 'pending_qr',
            })
            .eq('user_id', userId);

        if (!error) return true;

        const details = error.details || error.hint || '';
        console.error(`Error al subir QR (intento ${attempt}/${retries}):`, error.message, details);

        if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 2000));
        }
    }
    return false;
}

client.on('qr', async (qr) => {
    if (qrUploaded) {
        console.log('QR regenerado (ignorado, ya se subió uno válido).');
        return;
    }

    console.log('--- NUEVO QR GENERADO ---');
    const ok = await uploadQrToSupabase(qr);
    if (ok) {
        console.log('QR subido a Supabase con éxito. Escanealo desde la web.');
        qrUploaded = true;
    } else {
        console.error('No se pudo subir el QR. Revisá internet, SUPABASE_URL y USER_ID en .env');
    }
});

client.on('ready', async () => {
    console.log('Bot de WhatsApp - Evento READY disparado.');
    
    // Actualizar estado en Supabase
    const { error } = await supabase
        .from('user_configs')
        .update({ 
            wpp_status: 'connected',
            wpp_qr_code: null,
            wpp_last_heartbeat: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Error al actualizar estado a connected en Supabase:', error.message);
    } else {
        console.log('Estado actualizado a CONNECTED en Supabase.');
    }

    const sendHeartbeat = async () => {
        const { error: hbError } = await supabase
            .from('user_configs')
            .update({
                wpp_status: 'connected',
                wpp_last_heartbeat: new Date().toISOString(),
            })
            .eq('user_id', userId);
        if (hbError) console.error('Error en heartbeat:', hbError.message);
    };

    await sendHeartbeat();
    // Heartbeat cada 20s para que la web detecte conexión real
    setInterval(sendHeartbeat, 20000);

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

async function safeUpdate(id, data, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { error } = await supabase.from('messages_log').update(data).eq('id', id);
            if (!error) return true;
            console.error(`Error en safeUpdate (intento ${i+1}):`, error.message);
        } catch (err) {
            console.error(`Excepción en safeUpdate (intento ${i+1}):`, err.message);
        }
        await new Promise(res => setTimeout(res, 2000));
    }
    return false;
}

function buildTransferInfo(aliasFromConfig) {
    const alias = (aliasFromConfig || DEFAULT_PAYMENT_ALIAS || '').trim();
    const cbu = (DEFAULT_PAYMENT_CBU || '').trim();
    return `\n\nPodés abonar por transferencia:\n• *Alias:* ${alias}\n• *CBU:* ${cbu}`;
}

/** Misma lógica que la web (api.ts): días desde vencimiento, no el campo dias en DB. */
function computeDaysFromVencimiento(vencimiento) {
    if (!vencimiento) return null;
    const dateStr = String(vencimiento).slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const vDate = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(vDate.getTime())) return null;
    vDate.setHours(0, 0, 0, 0);
    return Math.round((vDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveClientDays(vencimiento, diasStored) {
    const fromDate = computeDaysFromVencimiento(vencimiento);
    if (fromDate !== null && Number.isFinite(fromDate)) return fromDate;
    const stored = Number(diasStored);
    return Number.isFinite(stored) ? stored : null;
}

function buildAutomationMessageByDays(dias, total, aliasFromConfig) {
    const alias = (aliasFromConfig || DEFAULT_PAYMENT_ALIAS || '').trim();
    const cbu = (DEFAULT_PAYMENT_CBU || '').trim();
    const totalText = Number(total || 0).toLocaleString('es-AR');

    if (dias === 0) {
        return `Hola Quería recordarte que hoy vence tu suscripción ⚠️
¿Vas a querer renovar? 

Debe abonar hoy! 💰 ${totalText}

cbu : ${cbu}
y alias : ${alias}`;
    }

    if (dias > 0) {
        return `Hola Quería recordarte que en 3 dias vence tu suscripción ⚠️
¿Vas a querer renovar? 

Debe abonar 💰 ${totalText}

cbu : ${cbu}
y alias : ${alias}`;
    }

    if (dias <= -1 && dias >= -30) {
        return MSG_EXPIRED_1_30;
    }

    if (dias <= -31) {
        return MSG_LOST_OVER_30;
    }

    if (dias < 0) {
        return MSG_EXPIRED_1_30;
    }

    return MSG_EXPIRED_1_30;
}

function isCanonicalAutomationMessage(message) {
    const lower = String(message || '').toLowerCase();
    return (
        lower.includes('ya está vencida') ||
        lower.includes('procedemos con la baja') ||
        lower.includes('hoy vence tu suscripción') ||
        lower.includes('en 3 dias vence tu suscripción') ||
        lower.includes('no renovas tu suscripción hace un tiempo') ||
        lower.includes('no renovas tu servicio hace un tiempo') ||
        lower.includes('reincorporarte con un 10% de descuento')
    );
}

function buildAutomationMessage(msgType, originalMessage, vencimiento, diasStored, total, aliasFromConfig) {
    const queued = String(originalMessage || '').trim();
    const effectiveDias = resolveClientDays(vencimiento, diasStored);

    if (msgType === 'recordatorio') {
        return buildAutomationMessageByDays(3, total, aliasFromConfig);
    }

    if (msgType === 'vencido' || msgType === 'recuperacion') {
        return msgType === 'vencido' ? MSG_EXPIRED_1_30 : MSG_LOST_OVER_30;
    }

    // Prioridad: fecha real del cliente (como la pestaña Vencidos / Recuperación)
    if (effectiveDias !== null) {
        if (effectiveDias >= 1 && effectiveDias <= 3) {
            return buildAutomationMessageByDays(3, total, aliasFromConfig);
        }
        if (effectiveDias === 0) {
            return buildAutomationMessageByDays(0, total, aliasFromConfig);
        }
        if (effectiveDias <= -1 && effectiveDias >= -30) {
            return MSG_EXPIRED_1_30;
        }
        if (effectiveDias <= -31) {
            return MSG_LOST_OVER_30;
        }
    }

    if (queued && isCanonicalAutomationMessage(queued)) {
        return queued;
    }

    const msgLower = queued.toLowerCase();

    if (
        msgLower.includes('hoy vence tu suscripción') ||
        msgLower.includes('venció hoy') ||
        msgLower.includes('debe abonar hoy')
    ) {
        return buildAutomationMessageByDays(0, total, aliasFromConfig);
    }

    if (
        msgLower.includes('en 3 dias vence tu suscripción') ||
        msgLower.includes('en 3 dias  vence tu suscripción')
    ) {
        return buildAutomationMessageByDays(3, total, aliasFromConfig);
    }

    if (
        msgLower.includes('ya está vencida') ||
        msgLower.includes('procedemos con la baja')
    ) {
        return MSG_EXPIRED_1_30;
    }

    if (
        msgLower.includes('no renovas tu suscripción hace un tiempo') ||
        msgLower.includes('no renovas tu servicio hace un tiempo') ||
        msgLower.includes('reincorporarte con un 10% de descuento') ||
        msgLower.includes('te gustaria retomar con alguno de nuestros servicios')
    ) {
        return MSG_LOST_OVER_30;
    }

    return buildAutomationMessageByDays(effectiveDias ?? Number(diasStored), total, aliasFromConfig);
}
async function startPolling() {
    // Polling cada 20 segundos (para cumplir con la meta de 3 mensajes por minuto)
    setInterval(async () => {
        try {
            // Buscamos 1 mensaje no enviado a la vez de ESTE usuario
            // Los links de MP ya vienen incluidos en el mensaje desde send-reminders
            const { data: messages, error } = await supabase
                .from('messages_log')
                .select('*, clients(celular, dias, total, vencimiento)')
                .eq('user_id', userId)
                .eq('enviado', false)
                .order('created_at', { ascending: true })
                .limit(1); 

            // Buscamos el alias actual del usuario para inyectarlo si no está
            const { data: config } = await supabase
                .from('user_configs')
                .select('payment_alias')
                .eq('user_id', userId)
                .single();
            
            const currentAlias = config?.payment_alias || DEFAULT_PAYMENT_ALIAS;

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

                // --- PLAN B: FORZAR TEMPLATE FINAL POR DÍAS ---
                const clientDaysNow = resolveClientDays(msg.clients?.vencimiento, msg.clients?.dias);
                const clientTotalNow = Number(msg.clients?.total || 0);
                let finalMessage = buildAutomationMessage(
                    msg.tipo,
                    msg.mensaje,
                    msg.clients?.vencimiento,
                    msg.clients?.dias,
                    clientTotalNow,
                    currentAlias
                );
                
                // 1. Eliminar cualquier rastro de link de Mercado Pago
                finalMessage = finalMessage.replace(/Podés pagar desde este link:[\s\S]*?https:\/\/www\.mercadopago\.com\.ar\/checkout\/v1\/redirect\?pref_id=[^\s]*/g, '');
                finalMessage = finalMessage.replace(/O mediante este link \(con recargo\):[\s\S]*?https:\/\/www\.mercadopago\.com\.ar\/checkout\/v1\/redirect\?pref_id=[^\s]*/g, '');
                finalMessage = finalMessage.replace(/https:\/\/www\.mercadopago\.com\.ar\/checkout\/v1\/redirect\?pref_id=[^\s]*/g, '');
                
                // 2. Si faltan alias o CBU, agregar bloque de transferencia
                const shouldContainTransferData = finalMessage.includes('Debe abonar');
                const missingAlias = currentAlias && !finalMessage.includes(currentAlias);
                const missingCbu = !finalMessage.includes(DEFAULT_PAYMENT_CBU);
                if (shouldContainTransferData && (missingAlias || missingCbu)) {
                    finalMessage += buildTransferInfo(currentAlias);
                }

                // Limpiar saltos de línea triples que puedan quedar
                finalMessage = finalMessage.replace(/\n\n\n+/g, '\n\n').trim();

                try {
                    console.log(`Enviando mensaje a ${formattedPhone}...`);
                    console.log(`Días efectivos: ${clientDaysNow} | Tipo cola: ${msg.tipo}`);
                    console.log(`Contenido final: "${finalMessage.substring(0, 50)}..."`);
                    await client.sendMessage(formattedPhone, finalMessage);
                    
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

// Graceful shutdown: actualizar estado a disconnected al cerrar el proceso
async function gracefulShutdown(signal) {
    console.log(`\n${signal} recibido. Cerrando bot...`);
    try {
        await supabase
            .from('user_configs')
            .update({ wpp_status: 'disconnected' })
            .eq('user_id', userId);
        console.log('Estado actualizado a DISCONNECTED en Supabase.');
    } catch (err) {
        console.error('Error al actualizar estado en shutdown:', err.message);
    }
    try { await client.destroy(); } catch (_) {}
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', async (err) => {
    console.error('Excepción no capturada:', err.message);
    await gracefulShutdown('uncaughtException');
});

function isContextDestroyedError(message) {
    const msg = String(message || '');
    return (
        msg.includes('Execution context was destroyed') ||
        msg.includes('Protocol error') ||
        msg.includes('detached Frame')
    );
}

async function initializeWithRetry(maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Intento de inicialización ${attempt}/${maxRetries}...`);
            await client.initialize();
            return;
        } catch (err) {
            console.error(`Error al inicializar el cliente (intento ${attempt}/${maxRetries}):`, err.message);
            try { await client.destroy(); } catch (_) {}

            if (attempt < maxRetries) {
                const waitSec = attempt * 8;
                console.log(`Reintentando en ${waitSec} segundos...`);
                await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
            } else {
                console.error('Se agotaron todos los intentos de inicialización.');
                if (isContextDestroyedError(err.message)) {
                    console.error('');
                    console.error('Sugerencia: borrá la sesión y volvé a escanear el QR:');
                    console.error('  npm run start:clean');
                    console.error('(o borrá manualmente la carpeta bot-whatsapp/.wwebjs_auth)');
                }
                process.exit(1);
            }
        }
    }
}

initializeWithRetry();
