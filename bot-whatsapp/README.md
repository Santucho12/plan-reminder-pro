# Bot WhatsApp experimental (whatsapp-web.js)

**¡ATENCIÓN!** Esta solución es experimental y solo para uso personal. Tu número puede ser bloqueado por WhatsApp si abusas del envío automático.

## Requisitos
- Node.js instalado
- WhatsApp en tu teléfono

## Instalación

1. Abre una terminal en esta carpeta:

   cd bot-whatsapp

2. Instala las dependencias:

   npm install

3. Ejecuta el bot:

   npm start

4. Escanea el QR que aparece en la terminal con tu WhatsApp (como si iniciaras sesión en WhatsApp Web).

5. Cuando veas "Bot listo", puedes editar `index.js` para enviar mensajes automáticos, o usar el método `sendMessage` desde el código.

### Ejemplo para enviar un mensaje

En `index.js`, descomenta y edita la línea:

```js
// sendMessage('549XXXXXXXXXX@c.us', '¡Hola desde mi bot!');
```

Reemplaza `549XXXXXXXXXX` por el número de destino (código país + código área + número, sin + ni espacios).

---

**No uses esto para spam ni para producción.**
