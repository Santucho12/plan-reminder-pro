export interface Client {
  id: string;
  nombre: string;
  celular: string;
  plan: string;
  vencimiento: Date;
  total: number;
  estado: string;
  ultimoMensaje?: Date;
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
