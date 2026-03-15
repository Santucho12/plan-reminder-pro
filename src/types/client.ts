export interface Client {
  id: string;
  nombre: string;
  celular: string;
  plan: string;
  vencimiento: Date;
  total: number;
  estado: 'pagado' | 'pendiente' | 'vencido';
  ultimoMensaje?: Date;
  alertas?: string;
  dias?: string;
}

export type ColumnMapping = {
  nombre: string;
  celular: string;
  plan: string;
  vencimiento: string;
  total: string;
  alertas?: string;
  dias?: string;
};
