export interface Client {
  id: string;
  nombre: string;
  apellido: string;
  celular: string;
  plan: string;
  vencimiento: Date;
  total: number;
  estado: 'pagado' | 'pendiente' | 'vencido';
  ultimoMensaje?: Date;
}

export type ColumnMapping = {
  nombre: string;
  apellido: string;
  celular: string;
  plan: string;
  vencimiento: string;
  total: string;
};
