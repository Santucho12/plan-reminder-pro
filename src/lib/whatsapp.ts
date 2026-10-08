import { format, isBefore, isToday, startOfDay, subDays } from 'date-fns';
import { Client, CobroData, Plan, Seguimiento } from '@/types/client';
import { cleanPhone } from '@/lib/api';

export type MessageSegment = 'today' | 'soon' | 'expired' | 'lost';
/** Plantillas que no dependen del vencimiento: se envían a mano desde la ficha o después de una acción. */
export type ExtraTemplate = 'welcome' | 'paid' | 'increase';
export type TemplateKey = MessageSegment | ExtraTemplate;
export type MessageTemplates = Record<TemplateKey, string>;

export const MESSAGE_SEGMENTS: MessageSegment[] = ['today', 'soon', 'expired', 'lost'];
export const EXTRA_TEMPLATES: ExtraTemplate[] = ['welcome', 'paid', 'increase'];
export const TEMPLATE_KEYS: TemplateKey[] = [...MESSAGE_SEGMENTS, ...EXTRA_TEMPLATES];

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  today: 'Vence hoy',
  soon: 'Recordatorio',
  expired: 'Vencido',
  lost: 'Recuperación',
  welcome: 'Bienvenida',
  paid: 'Pago recibido',
  increase: 'Aumento de precio',
};

export const SEGUIMIENTO_LABELS: Record<Seguimiento, string> = {
  prometio_pago: 'Prometió pagar',
  no_molestar: 'No molestar',
  baja: 'Dado de baja',
};

/** Variables que se reemplazan con los datos del cliente y de cobro al armar el mensaje. */
export const TEMPLATE_VARIABLES = ['[Nombre]', '[Plan]', '[Total]', '[Dias]', '[Vencimiento]', '[Alias]', '[CBU]'] as const;
const VARIABLE_NAMES = TEMPLATE_VARIABLES.map(v => v.slice(1, -1)).join('|');
/** Para partir un texto dejando las variables como elementos propios (ej: resaltarlas). */
export const VARIABLE_SPLIT_PATTERN = new RegExp(`(\\[(?:${VARIABLE_NAMES})\\])`, 'g');
const VARIABLE_PATTERN = new RegExp(`\\[(?:${VARIABLE_NAMES})\\]`, 'g');

/** Vacío a propósito: cada usuario carga sus propios datos en Configuración. */
export const DEFAULT_COBRO: CobroData = {
  alias: '',
  cbu: '',
};

/** Todavía no cargó ningún dato para que el cliente pueda pagar. */
export const isCobroEmpty = (cobro: CobroData) => !cobro.alias.trim() && !cobro.cbu.trim();

export const DEFAULT_TEMPLATES: MessageTemplates = {
  today: `Hola Quería recordarte que hoy vence tu suscripción ⚠️
¿Vas a querer renovar?

Debe abonar hoy! 💰 [Total]

cbu : [CBU]
y alias : [Alias]`,
  soon: `Hola Quería recordarte que el [Vencimiento] vence tu suscripción ⚠️
¿Vas a querer renovar?

Debe abonar 💰 [Total]

cbu : [CBU]
y alias : [Alias]`,
  expired: `Hola
Tú suscripción ya está vencida ⚠️

Vimos que aún no abonaste tu servicio, vas a querer renovar o procedemos con la baja? ❌

Muchas gracias!`,
  lost: `Hola 👋🏼
Notamos que no renovas tu suscripción hace un tiempo⚠️
Te ofrecemos la oportunidad de reincorporarte con un 10% de descuento en cualquier plataforma que elijas 😁`,
  welcome: `Hola [Nombre] 👋🏼
Ya quedó activo tu plan [Plan] ✅

Tu próximo vencimiento es el [Vencimiento].
Cualquier consulta escribinos por acá!`,
  paid: `Hola [Nombre] ✅
Recibimos tu pago de 💰 [Total]

Tu plan [Plan] queda activo hasta el [Vencimiento].
Muchas gracias!`,
  increase: `Hola [Nombre] 👋🏼
Te avisamos que a partir de tu próxima renovación el valor de [Plan] pasa a ser de 💰 [Total]

Muchas gracias por seguir eligiéndonos!`,
};

export interface AppSettings {
  templates: MessageTemplates;
  cobro: CobroData;
  planes: Plan[];
}

/** Forma en que se guarda la configuración en user_configs.settings (jsonb). */
export interface SettingsJson {
  version: 1;
  templates: MessageTemplates;
  cobro: CobroData;
  planes: Plan[];
}

/**
 * La configuración editable (plantillas, datos de cobro y catálogo de planes) se guarda junta en
 * user_configs.settings. Acepta también el texto JSON de la columna vieja (msg_recordatorio).
 * Cualquier otro contenido se ignora y se usan los valores predeterminados.
 */
export function parseSettings(raw: unknown): AppSettings {
  const settings: AppSettings = { templates: { ...DEFAULT_TEMPLATES }, cobro: { ...DEFAULT_COBRO }, planes: [] };
  try {
    const parsed: any = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return settings;

    for (const key of TEMPLATE_KEYS) {
      const value = parsed.templates?.[key];
      if (typeof value === 'string' && value.trim() !== '') settings.templates[key] = value;
    }
    for (const field of ['alias', 'cbu'] as const) {
      const value = parsed.cobro?.[field];
      if (typeof value === 'string') settings.cobro[field] = value;
    }
    if (Array.isArray(parsed.planes)) {
      settings.planes = parsed.planes
        .filter((p: any) => p && typeof p.nombre === 'string' && p.nombre.trim() !== '' && Number.isFinite(Number(p.precio)))
        .map((p: any) => {
          const plan: Plan = { nombre: p.nombre.trim(), precio: Number(p.precio) };
          const plataformas = Array.isArray(p.plataformas)
            ? p.plataformas.filter((x: unknown) => typeof x === 'string' && x.trim() !== '')
            : [];
          if (plataformas.length >= 2) plan.plataformas = plataformas;
          return plan;
        });
    }
  } catch {
    // No es nuestro JSON: quedan los valores predeterminados
  }
  return settings;
}

export function serializeSettings(settings: AppSettings): SettingsJson {
  return { version: 1, templates: settings.templates, cobro: settings.cobro, planes: settings.planes };
}

/** Clientes a los que no hay que escribirles aunque estén por vencer o vencidos. */
export function isMuted(client: Client): boolean {
  return client.seguimiento === 'no_molestar' || client.seguimiento === 'baja';
}

/** Segmento de mensajería del cliente según sus días al vencimiento (null si todavía no hay nada que avisar). */
export function getSegment(client: Client): MessageSegment | null {
  const dias = Number(client.dias);
  if (client.dias === undefined || client.dias === null || Number.isNaN(dias)) return null;
  if (isMuted(client)) return null;
  if (dias === 0) return 'today';
  // De 1 a 3 días, mientras no hayan recibido el aviso: si un día no se abre la app, al siguiente
  // siguen apareciendo. El que se avisó hoy sigue en la lista (marcado como enviado).
  if (dias >= 1 && dias <= 3) return wasRemindedThisCycle(client) ? null : 'soon';
  if (dias <= -1 && dias >= -30) return 'expired';
  if (dias < -30) return 'lost';
  return null;
}

/** Ya se le escribió desde que entró en la ventana de 3 días (sin contar hoy). */
function wasRemindedThisCycle(client: Client): boolean {
  const last = client.ultimoMensaje;
  if (!(last instanceof Date) || Number.isNaN(last.getTime()) || isToday(last)) return false;
  if (!(client.vencimiento instanceof Date) || Number.isNaN(client.vencimiento.getTime())) return false;
  const windowStart = subDays(startOfDay(client.vencimiento), 3);
  return !isBefore(last, windowStart);
}

export function renderTemplate(template: string, client: Client, cobro: CobroData = DEFAULT_COBRO): string {
  const vencimiento = client.vencimiento instanceof Date && !Number.isNaN(client.vencimiento.getTime())
    ? format(client.vencimiento, 'dd/MM/yyyy')
    : '';
  const values: Record<string, string> = {
    '[Nombre]': client.nombre ?? '',
    '[Plan]': client.plan ?? '',
    '[Total]': Number(client.total || 0).toLocaleString('es-AR'),
    '[Dias]': String(Math.abs(Number(client.dias) || 0)),
    '[Vencimiento]': vencimiento,
    '[Alias]': cobro.alias,
    '[CBU]': cobro.cbu,
  };
  return template.replace(VARIABLE_PATTERN, (variable) => values[variable]);
}

export function buildWhatsAppMessage(
  client: Client,
  templates: MessageTemplates = DEFAULT_TEMPLATES,
  cobro: CobroData = DEFAULT_COBRO,
  /** Plantilla a usar; si no se indica, la del segmento del cliente. */
  key?: TemplateKey,
): string {
  // Fuera de los segmentos (más de 3 días) se usa el recordatorio estándar
  const template: TemplateKey = key ?? getSegment(client) ?? 'soon';
  return renderTemplate(templates[template], client, cobro);
}

/** Link wa.me al chat del cliente con el mensaje prearmado. Devuelve null si no tiene un número usable. */
export function buildWhatsAppUrl(client: Client, message: string): string | null {
  const phone = cleanPhone(client.celular);
  if (!phone || phone.length < 8) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
