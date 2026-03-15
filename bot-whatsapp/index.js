// Bot WhatsApp experimental usando whatsapp-web.js
// Uso: node index.js
// Sigue las instrucciones en consola para escanear el QR con tu WhatsApp

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('Escanea este QR con tu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot listo. Puedes enviar mensajes usando sendMessage(destino, mensaje)');
    // Ejemplo automático:
    // sendMessage('549XXXXXXXXXX@c.us', '¡Hola desde mi bot!');
});

// Función para enviar mensajes
function sendMessage(to, message) {
    client.sendMessage(to, message)
        .then(() => console.log('Mensaje enviado a', to))
        .catch(console.error);
}

// Exportar para uso interactivo si quieres usar node REPL
module.exports = { sendMessage };

client.initialize();
