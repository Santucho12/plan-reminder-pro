// src/integrations/mercadopago/types.ts

export interface PaymentPreference {
  items: Array<{
    title: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  // Puedes agregar más campos según la documentación de Mercado Pago
}
