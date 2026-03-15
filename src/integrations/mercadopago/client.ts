// src/integrations/mercadopago/client.ts
// Cliente básico para Mercado Pago usando fetch

const MP_BASE_URL = 'https://api.mercadopago.com';

export async function createPayment(preference: any, accessToken: string) {
  const res = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  });
  if (!res.ok) throw new Error('Error creando preferencia de pago');
  return res.json();
}

export async function getPayment(paymentId: string, accessToken: string) {
  const res = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error('Error obteniendo pago');
  return res.json();
}
