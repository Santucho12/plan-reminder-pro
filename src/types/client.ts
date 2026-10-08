export type Seguimiento = 'prometio_pago' | 'no_molestar' | 'baja';

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
  /** Estado manual que carga el usuario (independiente del vencimiento). */
  seguimiento?: Seguimiento | null;
}

export type ColumnMapping = {
  nombre: string;
  celular: string;
  plan: string;
  vencimiento: string;
  total: string;
};

export interface Payment {
  id: string;
  client_id: string | null;
  cliente_nombre: string;
  plan: string;
  monto: number;
  medio: string;
  /** 'yyyy-MM-dd' */
  fecha_pago: string;
  vencimiento_anterior: string | null;
  vencimiento_nuevo: string | null;
  created_at?: string;
}

export interface ClientEvent {
  id: string;
  client_id: string;
  tipo: 'mensaje' | 'nota' | 'estado';
  detalle: string;
  created_at: string;
}

export interface Plan {
  nombre: string;
  precio: number;
  /** Si tiene plataformas es un combo: agrupa esos planes con un precio propio. */
  plataformas?: string[];
}

export const isCombo = (plan: Plan) => (plan.plataformas?.length ?? 0) > 0;

export interface CobroData {
  alias: string;
  cbu: string;
}
