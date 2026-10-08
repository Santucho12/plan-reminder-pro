import { supabase } from '@/integrations/supabase/client';
import { Client, ClientEvent, ColumnMapping, Payment } from '@/types/client';
import { addMonths, differenceInDays, startOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import XLSX from 'xlsx-js-style';
import { parsePlatforms } from '@/lib/platforms';

export const cleanPhone = (phone: any) => {
  if (!phone) return null;
  // Limpiar todo lo que no sea número
  let cleaned = String(phone).replace(/\D/g, '');

  // Caso Argentina: prefijo interurbano 0 + número local de 10 dígitos (ej: 02915371541)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Caso Argentina: Número local de 10 dígitos (ej: 2915371541)
  // WhatsApp requiere 54 + 9 + cod_area + numero
  if (cleaned.length === 10) {
    return `549${cleaned}`;
  }

  // Caso Argentina: Ya tiene el 54 pero le falta el 9 (ej: 542915371541 tiene 12 dígitos)
  if (cleaned.length === 12 && cleaned.startsWith('54')) {
    return `549${cleaned.substring(2)}`;
  }

  // Si ya tiene 13 dígitos y empieza con 549, está perfecto
  return cleaned;
};

/** Interpreta montos escritos como "15.000", "$ 1.500,50", "1500,5" o "1500.50". */
export function parseAmount(value: unknown): number {
  const s = String(value ?? '').replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  let normalized: string;
  if (s.includes('.') && s.includes(',')) {
    // El último separador es el decimal; el otro es de miles
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normalized = s.split(thousands).join('').replace(decimal, '.');
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
    // Solo separadores de miles (ej: 15.000 o 1.250.000)
    normalized = s.replace(/[.,]/g, '');
  } else {
    normalized = s.replace(',', '.');
  }

  return parseFloat(normalized) || 0;
}

/** Convierte una fecha de Excel (número de serie, DD/MM/YYYY, YYYY-MM-DD, etc.) a 'yyyy-MM-dd'. */
export function parseExcelDate(value: unknown): string {
  const str = String(value ?? '').trim();
  const today = () => format(new Date(), 'yyyy-MM-dd');
  if (!str) return today();

  // Número de serie de Excel (ej: 46097 para 16-Mar-2026)
  const serial = Number(str);
  if (!isNaN(serial) && serial > 10000 && serial < 100000) {
    return new Date(Date.UTC(1900, 0, serial - 1)).toISOString().split('T')[0];
  }

  const match = str.match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);
  if (match) {
    const a = Number(match[1]), b = Number(match[2]), c = Number(match[3]);
    let year: number, month: number, day: number;

    if (a > 31) {
      // 2026-03-16 -> año primero
      year = a; month = b; day = c;
    } else {
      year = c < 100 ? 2000 + c : c;
      if (b > 12) {
        // 03/16/2026 -> el segundo es el día
        day = b; month = a;
      } else {
        // 16/03/2026 o 06/07/2026 -> formato argentino DD/MM/YYYY
        day = a; month = b;
      }
    }

    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month - 1) return format(d, 'yyyy-MM-dd');
  }

  const fallback = new Date(str);
  return !isNaN(fallback.getTime()) ? format(fallback, 'yyyy-MM-dd') : today();
}

/** Estado que se muestra en la app, siempre derivado de los días al vencimiento. */
export function computeEstado(dias: number): string {
  if (dias === 0) return 'Vence hoy';
  if (dias > 0 && dias <= 3) return 'Por vencer';
  if (dias < 0) return 'Vencido';
  return 'Activo';
}

const PAGE_SIZE = 1000;

/** Supabase devuelve como máximo 1000 filas por consulta: se pagina para traer todas. */
async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

export interface ImportRow {
  nombre: string;
  celular: string;
  plan: string;
  /** 'yyyy-MM-dd' */
  vencimiento: string;
  total: number;
  dias: number;
  /** Aclaraciones que venían junto a las plataformas ("ya pagó, estirar el 10/10"). Solo para clientes nuevos. */
  nota_plataforma?: string;
}

export interface ImportChange {
  id: string;
  nombre: string;
  updates: Partial<ImportRow>;
  /** Descripción legible de cada dato que cambia, ej: "Total: $1.000 → $1.500" */
  cambios: string[];
}

export interface ImportPlan {
  nuevos: ImportRow[];
  modificados: ImportChange[];
  sinCambios: number;
  /** Clientes que están en la base pero no en el archivo. */
  ausentes: { id: string; nombre: string }[];
  /** Filas del archivo sin total: se cargarían con $0. */
  sinTotal: string[];
  /** Filas del archivo sin teléfono (solo si se importan los teléfonos). */
  sinCelular: number;
}

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
const formatDay = (day: string) => day.split('-').reverse().join('/');
const formatMoney = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;

/**
 * Qué datos del Excel no se toman. Teléfonos y plataformas suelen venir mal escritos: si se ignoran,
 * los clientes nuevos quedan sin ese dato (se carga a mano) y los existentes conservan el suyo.
 */
export interface ImportOptions {
  ignorePhone?: boolean;
  ignorePlan?: boolean;
}

/** Filas del Excel ya normalizadas (teléfono, fecha y monto). Descarta las que no tienen nombre. */
export function parseImportRows(rows: Record<string, string>[], mapping: ColumnMapping, options: ImportOptions = {}): ImportRow[] {
  const validRows = rows.filter(row => row[mapping.nombre] && String(row[mapping.nombre]).trim() !== '');
  if (validRows.length === 0) {
    throw new Error('El archivo no tiene filas con nombre de cliente.');
  }

  return validRows.map((row) => {
    // Los códigos de la planilla ("NET+MAX 2 ya pagó") se traducen a plataformas y nota
    const { plan, nota } = options.ignorePlan ? { plan: '', nota: '' } : parsePlatforms(row[mapping.plan]);
    return {
      nombre: String(row[mapping.nombre]).trim(),
      celular: options.ignorePhone ? '' : cleanPhone(row[mapping.celular]) || '',
      plan,
      vencimiento: parseExcelDate(row[mapping.vencimiento]),
      total: parseAmount(row[mapping.total]),
      // Los días se calculan al leer los clientes; la columna del Excel es una fórmula y no se usa
      dias: 0,
      ...(nota ? { nota_plataforma: nota } : {}),
    };
  });
}

/**
 * Compara el Excel con los clientes guardados. Cada fila se cruza con un cliente existente por
 * celular (o por nombre si no hay celular que coincida) para actualizarlo en lugar de duplicarlo,
 * así se conservan sus notas, su historial de pagos y de mensajes.
 */
export function buildImportPlan(incoming: ImportRow[], existing: any[], options: ImportOptions = {}): ImportPlan {
  const byPhone = new Map<string, any[]>();
  const byName = new Map<string, any[]>();
  const push = (map: Map<string, any[]>, key: string, row: any) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(row); else map.set(key, [row]);
  };
  for (const row of existing) {
    push(byPhone, cleanPhone(row.celular) || '', row);
    push(byName, normalizeText(row.nombre), row);
  }

  const used = new Set<string>();
  const plan: ImportPlan = {
    nuevos: [], modificados: [], sinCambios: 0, ausentes: [],
    sinTotal: incoming.filter(r => !r.total).map(r => r.nombre),
    sinCelular: options.ignorePhone ? 0 : incoming.filter(r => !r.celular).length,
  };

  for (const row of incoming) {
    const samePhone = (byPhone.get(row.celular) || []).filter(c => !used.has(c.id));
    const sameName = (byName.get(normalizeText(row.nombre)) || []).filter(c => !used.has(c.id));
    // Un mismo celular puede tener varios planes: se elige el del mismo plan, después el del mismo nombre
    const match =
      samePhone.find(c => normalizeText(c.plan) === normalizeText(row.plan)) ||
      samePhone.find(c => normalizeText(c.nombre) === normalizeText(row.nombre)) ||
      samePhone[0] ||
      (sameName.length === 1 ? sameName[0] : undefined);

    if (!match) {
      plan.nuevos.push(row);
      continue;
    }
    used.add(match.id);

    const updates: Partial<ImportRow> = {};
    const cambios: string[] = [];
    if (String(match.nombre ?? '').trim() !== row.nombre) {
      updates.nombre = row.nombre;
      cambios.push(`Nombre: ${match.nombre} → ${row.nombre}`);
    }
    // Los datos ignorados no se comparan: el cliente existente conserva los suyos
    if (!options.ignorePhone && (cleanPhone(match.celular) || '') !== row.celular) {
      updates.celular = row.celular;
      cambios.push(`Celular: ${match.celular || 'sin número'} → ${row.celular || 'sin número'}`);
    }
    if (!options.ignorePlan && String(match.plan ?? '') !== row.plan) {
      updates.plan = row.plan;
      cambios.push(`Plan: ${match.plan || '—'} → ${row.plan || '—'}`);
    }
    const currentDay = String(match.vencimiento ?? '').slice(0, 10);
    if (currentDay !== row.vencimiento) {
      updates.vencimiento = row.vencimiento;
      cambios.push(`Vencimiento: ${formatDay(currentDay)} → ${formatDay(row.vencimiento)}`);
    }
    if (Number(match.total) !== row.total) {
      updates.total = row.total;
      cambios.push(`Total: ${formatMoney(Number(match.total))} → ${formatMoney(row.total)}`);
    }

    if (cambios.length === 0) plan.sinCambios++;
    else plan.modificados.push({ id: match.id, nombre: row.nombre, updates, cambios });
  }

  plan.ausentes = existing.filter(c => !used.has(c.id)).map(c => ({ id: c.id, nombre: c.nombre }));
  return plan;
}

/** Lee los clientes actuales y devuelve qué haría la importación, sin modificar nada. */
export async function previewImport(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  userId: string,
  options: ImportOptions = {},
): Promise<ImportPlan> {
  const incoming = parseImportRows(rows, mapping, options);
  const existing = await fetchAllRows<any>((from, to) =>
    supabase.from('clients').select('*').eq('user_id', userId).order('id').range(from, to)
  );
  return buildImportPlan(incoming, existing, options);
}

export async function applyImport(plan: ImportPlan, userId: string, options: { removeMissing?: boolean } = {}) {
  const nuevos = plan.nuevos.map(row => ({ ...row, id: crypto.randomUUID(), user_id: userId, estado: 'pendiente' }));
  for (let i = 0; i < nuevos.length; i += 500) {
    const { error } = await supabase.from('clients').insert(nuevos.slice(i, i + 500));
    if (error) throw error;
  }

  for (let i = 0; i < plan.modificados.length; i += 20) {
    const results = await Promise.all(
      plan.modificados.slice(i, i + 20).map(change => supabase.from('clients').update(change.updates).eq('id', change.id))
    );
    const failed = results.find(r => r.error);
    if (failed) throw failed.error;
  }

  // Los que no vinieron en el archivo solo se borran si el usuario lo pidió, y recién al final:
  // si algo de lo anterior falla no se pierde ningún cliente.
  let eliminados = 0;
  if (options.removeMissing) {
    const ids = plan.ausentes.map(c => c.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from('clients').delete().in('id', ids.slice(i, i + 100));
      if (error) throw error;
    }
    eliminados = ids.length;
  }

  return { creados: nuevos.length, actualizados: plan.modificados.length, eliminados };
}

export async function fetchClients(userId: string) {
  const data = await fetchAllRows<any>((from, to) =>
    supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('vencimiento', { ascending: true })
      .order('id')
      .range(from, to)
  );

  const today = startOfDay(new Date());

  // Instanciar como Date local al mediodía para evitar desfases de zona horaria (UTC-3).
  // Y calcular DÍAS dinámicamente.
  return data.map((client: any) => {
    const vDate = new Date(`${client.vencimiento}T12:00:00`);
    const diff = differenceInDays(startOfDay(vDate), today);

    return {
      ...client,
      vencimiento: vDate,
      dias: diff.toString(),
      estado: computeEstado(diff)
    };
  });
}

export async function deleteClient(clientId: string) {
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
}

export async function updateClient(clientId: string, updates: any) {
  const finalUpdates = { ...updates };
  if (finalUpdates.celular) {
    finalUpdates.celular = cleanPhone(finalUpdates.celular);
  }
  // Normalize estado to DB-safe values (constraint: activo, pendiente, vencido)
  if (finalUpdates.estado) {
    const upper = String(finalUpdates.estado).toUpperCase();
    if (upper.includes('ACTIVO') || upper.includes('PAGADO')) finalUpdates.estado = 'activo';
    else if (upper.includes('VENCID') || upper === 'VENCE HOY') finalUpdates.estado = 'vencido';
    else finalUpdates.estado = 'pendiente';
  }

  const { data, error } = await supabase
    .from('clients')
    .update(finalUpdates)
    .eq('id', clientId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createClient(userId: string, clientData: any) {
  const finalData = { ...clientData };
  if (finalData.celular) {
    finalData.celular = cleanPhone(finalData.celular);
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ 
      ...finalData, 
      id: crypto.randomUUID(),
      user_id: userId, 
      dias: finalData.dias || 0 
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function updateUserConfig(userId: string, updates: Record<string, unknown>) {
  const values = { ...updates, updated_at: new Date().toISOString() };

  const { data: updated, error } = await supabase
    .from('user_configs')
    .update(values)
    .eq('user_id', userId)
    .select();
  if (error) throw error;
  if (updated && updated.length > 0) return updated[0];

  // Todavía no hay fila de configuración para este usuario
  const { data: inserted, error: insertError } = await supabase
    .from('user_configs')
    .insert({ user_id: userId, ...values })
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  return inserted;
}

/** Cambia el plan de varios clientes a la vez (cuando se renombra una plataforma o combo). */
export async function updateClientsPlan(clientIds: string[], plan: string) {
  for (let i = 0; i < clientIds.length; i += 100) {
    const { error } = await supabase.from('clients').update({ plan }).in('id', clientIds.slice(i, i + 100));
    if (error) throw error;
  }
}

/** Cambia el importe de varios clientes a la vez (aumentos de precio por plan). */
export async function updateClientsTotal(clientIds: string[], total: number) {
  for (let i = 0; i < clientIds.length; i += 100) {
    const { error } = await supabase.from('clients').update({ total }).in('id', clientIds.slice(i, i + 100));
    if (error) throw error;
  }
}

export const SCHEMA_PENDING_MESSAGE = 'Falta actualizar la base de datos: aplicá la última migración de Supabase.';

/** La tabla o columna todavía no existe porque no se aplicó la migración. */
export function isMissingSchema(error: any): boolean {
  const code = String(error?.code ?? '');
  return ['PGRST205', 'PGRST204', 'PGRST202', '42P01', '42703'].includes(code) || /schema cache/i.test(String(error?.message ?? ''));
}

const schemaError = (error: any) => (isMissingSchema(error) ? new Error(SCHEMA_PENDING_MESSAGE) : error);

/**
 * Workspace cuyos datos maneja el usuario logueado: el admin y el usuario configurable comparten
 * el del admin. Devuelve null si el usuario no es miembro. Sin la migración de usuarios
 * compartidos, cada usuario sigue usando sus propias filas.
 */
export async function fetchWorkspaceId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('current_workspace');
  if (error) {
    if (isMissingSchema(error)) return userId;
    throw error;
  }
  return (data as string | null) ?? null;
}

export interface Member {
  user_id: string;
  email: string;
  rol: 'admin' | 'usuario';
  /** Copia legible de la contraseña (null si todavía no se cambió desde la app). */
  clave: string | null;
}

/** Usuarios con acceso al sistema (el admin fijo y el usuario configurable). */
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase.rpc('list_members');
  if (error) throw schemaError(error);
  return (data || []) as Member[];
}

/** Cambia el mail y/o la contraseña del usuario configurable. Devuelve el mail que quedó. */
export async function updateConfigurableUser(input: { email?: string; password?: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('manage-user', { body: input });
  if (error) {
    let message = 'No se pudo actualizar el usuario';
    // 401 sin detalle de la función: el gateway de Supabase rechazó la sesión antes de llegar a ella
    if ((error as any).context?.status === 401) {
      message = 'El servidor rechazó tu sesión. Cerrá sesión y volvé a entrar; si sigue pasando, la función manage-user tiene que estar publicada sin "Verify JWT".';
    }
    try {
      const body = await (error as any).context?.json();
      if (body?.error) message = body.error;
    } catch {
      // Sin detalle del servidor: queda el mensaje genérico
    }
    throw new Error(message);
  }
  return data?.email;
}

/** Columna anterior donde se guardaba la configuración como texto JSON (antes de la migración 20261008). */
const LEGACY_SETTINGS_COLUMN = 'msg_recordatorio';

/** Configuración guardada del usuario (plantillas, cobro, catálogo) tal como está en la base, o null. */
export async function fetchSettingsJson(userId: string): Promise<unknown> {
  const { data, error } = await supabase.from('user_configs').select('settings').eq('user_id', userId).maybeSingle();
  if (!error) return (data as any)?.settings ?? null;
  if (!isMissingSchema(error)) throw error;

  // Todavía no se aplicó la migración: se lee la columna vieja
  const legacy = await supabase.from('user_configs').select(LEGACY_SETTINGS_COLUMN).eq('user_id', userId).maybeSingle();
  if (legacy.error) throw legacy.error;
  return (legacy.data as any)?.[LEGACY_SETTINGS_COLUMN] ?? null;
}

export async function saveSettingsJson(userId: string, settings: object) {
  try {
    await updateUserConfig(userId, { settings });
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    await updateUserConfig(userId, { [LEGACY_SETTINGS_COLUMN]: JSON.stringify(settings) });
  }
}

/**
 * Nuevo vencimiento al cobrar: se suman los meses al vencimiento actual, o a hoy si ya estaba
 * vencido (no se le cobran los días que estuvo sin servicio).
 */
export function computeRenewal(vencimiento: Date, meses = 1, today: Date = new Date()): string {
  const current = startOfDay(vencimiento);
  const base = current > startOfDay(today) ? current : startOfDay(today);
  return format(addMonths(base, meses), 'yyyy-MM-dd');
}

export async function fetchPayments(userId: string): Promise<Payment[]> {
  const data = await fetchAllRows<any>((from, to) =>
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('fecha_pago', { ascending: false })
      .order('id')
      .range(from, to)
  );
  return data.map(p => ({ ...p, monto: Number(p.monto) }));
}

/** Registra el cobro y renueva al cliente hasta el nuevo vencimiento. */
export async function registerPayment(
  userId: string,
  client: Client,
  input: { monto: number; medio: string; vencimientoNuevo: string }
): Promise<Payment> {
  const payment: Payment = {
    id: crypto.randomUUID(),
    client_id: client.id,
    cliente_nombre: client.nombre,
    plan: client.plan || '',
    monto: input.monto,
    medio: input.medio,
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    vencimiento_anterior: format(client.vencimiento, 'yyyy-MM-dd'),
    vencimiento_nuevo: input.vencimientoNuevo,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('payments').insert({ ...payment, user_id: userId });
  if (error) throw schemaError(error);

  try {
    await updateClient(client.id, { vencimiento: input.vencimientoNuevo, estado: 'activo' });
  } catch (updateError) {
    // Sin renovación no tiene que quedar el pago cargado
    await supabase.from('payments').delete().eq('id', payment.id);
    throw updateError;
  }
  return payment;
}

/**
 * Borra un pago cargado por error y le devuelve al cliente el vencimiento que tenía.
 * Devuelve si el vencimiento volvió atrás: no lo hace si hubo una renovación posterior.
 */
export async function undoPayment(payment: Payment): Promise<{ vencimientoRevertido: boolean }> {
  let vencimientoRevertido = false;
  if (payment.client_id && payment.vencimiento_anterior && payment.vencimiento_nuevo) {
    // Solo si el vencimiento sigue siendo el que dejó este pago (no hubo renovaciones posteriores)
    const { data, error } = await supabase
      .from('clients')
      .update({ vencimiento: payment.vencimiento_anterior })
      .eq('id', payment.client_id)
      .eq('vencimiento', payment.vencimiento_nuevo)
      .select('id');
    if (error) throw error;
    vencimientoRevertido = (data?.length ?? 0) > 0;
  }
  const { error } = await supabase.from('payments').delete().eq('id', payment.id);
  if (error) throw error;
  return { vencimientoRevertido };
}

export async function fetchClientEvents(clientId: string): Promise<ClientEvent[]> {
  const { data, error } = await supabase
    .from('client_events')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }
  return (data || []) as ClientEvent[];
}

export async function addClientEvent(userId: string, clientId: string, tipo: ClientEvent['tipo'], detalle: string): Promise<ClientEvent> {
  const event: ClientEvent = { id: crypto.randomUUID(), client_id: clientId, tipo, detalle, created_at: new Date().toISOString() };
  const { error } = await supabase.from('client_events').insert({ ...event, user_id: userId });
  if (error) throw schemaError(error);
  return event;
}

export function exportClientsToExcel(clients: Client[]) {
  const headers = ['Nombre', 'Celular', 'Plan', 'Vencimiento', 'Total', 'Estado', 'Días'];
  const rows = clients.map(c => [
    c.nombre,
    c.celular,
    c.plan,
    c.vencimiento instanceof Date ? format(c.vencimiento, 'd/M/yyyy', { locale: es }) : String(c.vencimiento),
    c.total,
    String(c.estado).charAt(0).toUpperCase() + String(c.estado).slice(1),
    c.dias ?? '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
    fill: { fgColor: { rgb: '2F5496' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: {
      bottom: { style: 'thin' as const, color: { rgb: '1F3864' } },
    },
  };

  const cellStyle = {
    font: { sz: 10, name: 'Calibri' },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const },
    border: {
      bottom: { style: 'thin' as const, color: { rgb: 'D9E2F3' } },
    },
  };

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Style headers
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerStyle;
  }

  // Style data rows with alternating colors
  for (let r = 1; r <= range.e.r; r++) {
    const isEven = r % 2 === 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      const estadoCol = 5; // Estado column index
      let fill = isEven ? { fgColor: { rgb: 'D9E2F3' } } : { fgColor: { rgb: 'FFFFFF' } };
      let fontColor = { rgb: '000000' };

      if (c === estadoCol) {
        const val = String(ws[addr].v || '').toUpperCase();
        if (val.includes('ACTIVO')) {
          fill = { fgColor: { rgb: 'C6EFCE' } };
          fontColor = { rgb: '006100' };
        } else if (val.includes('VENCIDO')) {
          fill = { fgColor: { rgb: 'FFC7CE' } };
          fontColor = { rgb: '9C0006' };
        } else if (val.includes('PENDIENTE')) {
          fill = { fgColor: { rgb: 'FFEB9C' } };
          fontColor = { rgb: '9C6500' };
        }
      }

      ws[addr].s = {
        ...cellStyle,
        fill,
        font: { ...cellStyle.font, color: { rgb: fontColor.rgb } },
      };
    }
  }

  ws['!cols'] = [
    { wch: 25 }, // Nombre
    { wch: 16 }, // Celular
    { wch: 28 }, // Plan
    { wch: 14 }, // Vencimiento
    { wch: 10 }, // Total
    { wch: 12 }, // Estado
    { wch: 8 },  // Días
  ];

  // Row heights
  ws['!rows'] = [{ hpt: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `clientes_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
}
