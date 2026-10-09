import { Plan } from '@/types/client';

/**
 * Lo que tiene contratado un cliente: una o varias plataformas o combos, cada uno con su cantidad.
 * Se guarda en clients.plan como texto, en el mismo formato que la importación del Excel:
 *   "Disney+ x2 + YouTube Premium"   → Disney+ (2 cuentas) y YouTube Premium (1)
 * Los nombres de combos también llevan " + " ("Netflix + Disney+"): se reconocen usando el catálogo.
 */
export interface PlanItem {
  nombre: string;
  cantidad: number;
}

const SEPARATOR = ' + ';
const QTY = /^(.*?)\s+x\s*(\d+)$/i;
const key = (name: string) => name.trim().toLowerCase();

/** Separa el nombre de su cantidad: "Disney+ x2" → { Disney+, 2 }. */
function splitQty(text: string): PlanItem {
  const match = text.trim().match(QTY);
  return match ? { nombre: match[1].trim(), cantidad: Math.max(1, Number(match[2])) } : { nombre: text.trim(), cantidad: 1 };
}

export function parsePlanItems(plan: string | null | undefined, catalog: Plan[] = []): PlanItem[] {
  const parts = String(plan ?? '').split(SEPARATOR).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];
  const known = new Map(catalog.map(p => [key(p.nombre), p.nombre]));
  const items: PlanItem[] = [];

  for (let i = 0; i < parts.length;) {
    // Se prueba primero el tramo más largo: un combo "Netflix + Disney+" gana a "Netflix" suelto
    let matched: { item: PlanItem; next: number } | null = null;
    for (let j = parts.length; j > i + 1 && !matched; j--) {
      const candidate = splitQty(parts.slice(i, j).join(SEPARATOR));
      const name = known.get(key(candidate.nombre));
      if (name) matched = { item: { nombre: name, cantidad: candidate.cantidad }, next: j };
    }
    if (!matched) {
      const single = splitQty(parts[i]);
      matched = { item: { nombre: known.get(key(single.nombre)) ?? single.nombre, cantidad: single.cantidad }, next: i + 1 };
    }
    // El mismo nombre dos veces se junta en una sola fila
    const same = items.find(it => key(it.nombre) === key(matched!.item.nombre));
    if (same) same.cantidad += matched.item.cantidad; else items.push(matched.item);
    i = matched.next;
  }
  return items;
}

export function formatPlanItems(items: PlanItem[]): string {
  return items
    .filter(it => it.nombre.trim() !== '')
    .map(it => (it.cantidad > 1 ? `${it.nombre.trim()} x${it.cantidad}` : it.nombre.trim()))
    .join(SEPARATOR);
}

/** Precio según el catálogo (precio × cantidad, sumados), o null si algo no está en el catálogo. */
export function priceOfItems(items: PlanItem[], catalog: Plan[]): number | null {
  if (items.length === 0) return null;
  let total = 0;
  for (const it of items) {
    const plan = catalog.find(p => key(p.nombre) === key(it.nombre));
    if (!plan) return null;
    total += plan.precio * it.cantidad;
  }
  return total;
}

/** Precio que debería pagar un cliente según el catálogo, o null si su plan no está (completo) en el catálogo. */
export function expectedPrice(plan: string, catalog: Plan[]): number | null {
  return priceOfItems(parsePlanItems(plan, catalog), catalog);
}

/** El plan incluye esa plataforma o combo (sola o junto a otras). */
export function planIncludes(plan: string, name: string, catalog: Plan[]): boolean {
  return parsePlanItems(plan, catalog).some(it => key(it.nombre) === key(name));
}

/** Cambia el nombre de una plataforma o combo dentro del plan; devuelve el texto nuevo (igual si no la tenía). */
export function renameInPlan(plan: string, from: string, to: string, catalog: Plan[]): string {
  const items = parsePlanItems(plan, catalog);
  if (!items.some(it => key(it.nombre) === key(from))) return plan;
  return formatPlanItems(items.map(it => (key(it.nombre) === key(from) ? { ...it, nombre: to } : it)));
}

/** Plataformas de un combo agrupadas con su cantidad: ["Disney+", "Disney+", "Max"] → Disney+ x2, Max x1. */
export function groupPlatforms(plataformas: string[] = []): PlanItem[] {
  const items: PlanItem[] = [];
  for (const nombre of plataformas) {
    const same = items.find(it => key(it.nombre) === key(nombre));
    if (same) same.cantidad++; else items.push({ nombre, cantidad: 1 });
  }
  return items;
}
