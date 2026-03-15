# Integración Mercado Pago

1. Copia `.env.example` a `.env` y completa tus credenciales de Mercado Pago.
2. Usa las funciones de `src/integrations/mercadopago/client.ts` para crear preferencias de pago y consultar pagos.
3. Consulta la documentación oficial para más opciones: https://www.mercadopago.com.ar/developers/es/docs/checkout-api

## Ejemplo de uso

```ts
import { createPayment } from '../integrations/mercadopago/client';

const preference = {
  items: [
    { title: 'Producto', quantity: 1, currency_id: 'ARS', unit_price: 100 }
  ]
};

const payment = await createPayment(preference, process.env.MP_ACCESS_TOKEN!);
console.log(payment.init_point); // URL de pago
```

---

¿Necesitás recibir notificaciones de pago (webhooks)? Avísame y te ayudo a configurarlo.
