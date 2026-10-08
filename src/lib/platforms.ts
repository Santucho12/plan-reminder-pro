/**
 * Traduce la columna "Plataformas" de la planilla del cliente, que usa códigos abreviados:
 *   "NET+MAX"                       → Netflix + Max
 *   "NET 2"                         → Netflix x2 (el número es la cantidad de cuentas o perfiles)
 *   "SUFF  ya pago, el 10/10 estirar" → SUFF, y el resto queda como nota
 */

/** Código de la planilla → nombre de la plataforma. El orden es el que se usa al armar los combos. */
export const PLATFORM_CODES: Record<string, string> = {
  NET: 'Netflix',
  DIS: 'Disney+',
  MAX: 'Max',
  AMZ: 'Amazon Prime Video',
  PARA: 'Paramount+',
  SPOT: 'Spotify',
  CRUN: 'Crunchyroll',
  // Pendientes de confirmar con el cliente: entran con su código y se renombran desde Plataformas
  SUFF: 'SUFF',
  FLUJO: 'FLUJO',
};

const CODE_ORDER = Object.keys(PLATFORM_CODES);
// Un código, opcionalmente seguido de la cantidad ("NET 2", "CRUN x2"); no toma fechas como "15/10"
const ITEM = new RegExp(`^\\s*(${CODE_ORDER.join('|')})\\b\\s*(?:x\\s*)?(\\d)?(?![\\d/])\\s*`, 'i');
// Lo que separa un ítem del siguiente: "+", con una aclaración opcional antes ("MAX 2 (pablo) + NET")
const SEPARATOR = /^(\([^)]*\))?\s*\+\s*/;

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

export interface ParsedPlatforms {
  /** Nombre del plan para la app, ej: "Netflix + Max" o "Netflix x2". Vacío si no hay nada. */
  plan: string;
  /** Lo que venía escrito después de las plataformas (nombres, fechas de cobro, bajas…). */
  nota: string;
}

export function parsePlatforms(raw: unknown): ParsedPlatforms {
  let rest = String(raw ?? '');
  const items: { code: string; qty: number }[] = [];
  const notes: string[] = [];

  for (;;) {
    const match = rest.match(ITEM);
    if (!match) break;
    items.push({ code: match[1].toUpperCase(), qty: match[2] ? Number(match[2]) : 1 });
    rest = rest.slice(match[0].length);
    const separator = rest.match(SEPARATOR);
    if (!separator) break;
    if (separator[1]) notes.push(separator[1]);
    rest = rest.slice(separator[0].length);
  }

  // Sin ningún código conocido se respeta lo escrito tal cual
  if (items.length === 0) return { plan: collapse(rest), nota: '' };

  notes.push(rest);
  // Mismo combo escrito en otro orden ("SUFF+NET" y "NET+SUFF") queda con el mismo nombre
  const plan = [...items]
    .sort((a, b) => CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code))
    .map(({ code, qty }) => (qty > 1 ? `${PLATFORM_CODES[code]} x${qty}` : PLATFORM_CODES[code]))
    .join(' + ');
  return { plan, nota: collapse(notes.join(' ')) };
}
