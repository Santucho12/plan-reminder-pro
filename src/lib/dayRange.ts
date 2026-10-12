import { addDays, format } from 'date-fns';

/** Estados que se muestran en el filtro, siempre en este orden. */
export const ESTADOS = ['Activo', 'Por vencer', 'Vence hoy', 'Vencido'];

/** Valor del filtro de estado para elegir un rango de días a mano. */
export const CUSTOM_RANGE = 'custom';

/** Rangos frecuentes para no tener que escribirlos. */
export const RANGE_PRESETS = [
  { label: 'Vencidos hace 1 a 7 días', short: 'Hace 1–7 días', from: -7, to: -1 },
  { label: 'Vencidos hace 8 a 30 días', short: 'Hace 8–30 días', from: -30, to: -8 },
  { label: 'Vencen en los próximos 7 días', short: 'Próximos 7 días', from: 0, to: 7 },
];

/** Rango de días al vencimiento (negativo = vencido). null = sin límite de ese lado. */
export interface DayRange {
  min: number | null;
  max: number | null;
}

const toNumber = (value: string): number | null => {
  if (value.trim() === '' || value.trim() === '-') return null;
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : null;
};

/** Lee lo escrito en "Desde" y "Hasta". Si están al revés se ordenan solos. */
export function parseDayRange(from: string, to: string): DayRange {
  let min = toNumber(from);
  let max = toNumber(to);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { min, max };
}

export function inDayRange(dias: number, { min, max }: DayRange): boolean {
  if (Number.isNaN(dias)) return false;
  return (min === null || dias >= min) && (max === null || dias <= max);
}

/** "hace 3 días", "hoy", "en 5 días". */
function when(n: number): string {
  if (n === 0) return 'hoy';
  const days = Math.abs(n) === 1 ? '1 día' : `${Math.abs(n)} días`;
  return n < 0 ? `hace ${days}` : `en ${days}`;
}

/** "el 05/10 (hace 7 días)" o "hoy (12/10)". */
function point(n: number, today: Date): string {
  const date = format(addDays(today, n), 'dd/MM');
  return n === 0 ? `hoy (${date})` : `el ${date} (${when(n)})`;
}

/** El rango en palabras y con fechas, ej: "Vencen entre el 05/10 (hace 7 días) y el 09/10 (hace 3 días)". */
export function describeDayRange({ min, max }: DayRange, today: Date = new Date()): string {
  if (min === null && max === null) return 'Escribí un rango de días';
  if (min !== null && max !== null) {
    return min === max ? `Vencen ${point(min, today)}` : `Vencen entre ${point(min, today)} y ${point(max, today)}`;
  }
  if (min !== null) return `Vencen desde ${point(min, today)} en adelante`;
  return `Vencen hasta ${point(max!, today)}`;
}
