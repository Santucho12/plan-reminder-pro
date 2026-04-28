export interface Client {
  id: string;
  nombre: string;
  apellido?: string;
  celular: string;
  plan: string;
  vencimiento: Date;
  total: number;
  estado: string;
  ultimoMensaje?: Date;
  dias?: number;
  nota_plataforma?: string;
  nota_precio?: string;
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
