import { describe, it, expect } from 'vitest';
import { expectedPrice, formatPlanItems, groupPlatforms, parsePlanItems, planIncludes, priceOfItems, renameInPlan } from '@/lib/plans';
import type { Plan } from '@/types/client';

const catalog: Plan[] = [
  { nombre: 'Disney+', precio: 6000 },
  { nombre: 'YouTube Premium', precio: 4000 },
  { nombre: 'Netflix', precio: 9000 },
  { nombre: 'Netflix + Disney+', precio: 13000, plataformas: ['Netflix', 'Disney+'] },
];

describe('parsePlanItems / formatPlanItems', () => {
  it('lee varias plataformas con cantidades', () => {
    expect(parsePlanItems('Disney+ x2 + YouTube Premium', catalog)).toEqual([
      { nombre: 'Disney+', cantidad: 2 },
      { nombre: 'YouTube Premium', cantidad: 1 },
    ]);
  });

  it('reconoce un combo aunque su nombre lleve " + "', () => {
    expect(parsePlanItems('Netflix + Disney+ + YouTube Premium', catalog)).toEqual([
      { nombre: 'Netflix + Disney+', cantidad: 1 },
      { nombre: 'YouTube Premium', cantidad: 1 },
    ]);
    expect(parsePlanItems('Netflix + Disney+ x2', catalog)).toEqual([{ nombre: 'Netflix + Disney+', cantidad: 2 }]);
  });

  it('sin catálogo o con nombres desconocidos respeta lo escrito', () => {
    expect(parsePlanItems('SUFF', catalog)).toEqual([{ nombre: 'SUFF', cantidad: 1 }]);
    expect(parsePlanItems('Netflix 4K', [])).toEqual([{ nombre: 'Netflix 4K', cantidad: 1 }]);
    expect(parsePlanItems('', catalog)).toEqual([]);
  });

  it('usa el nombre como está en el catálogo y junta repetidos', () => {
    expect(parsePlanItems('disney+ + Disney+', catalog)).toEqual([{ nombre: 'Disney+', cantidad: 2 }]);
  });

  it('arma el texto en el mismo formato que la importación', () => {
    expect(formatPlanItems([{ nombre: 'Disney+', cantidad: 2 }, { nombre: 'YouTube Premium', cantidad: 1 }, { nombre: '  ', cantidad: 1 }]))
      .toBe('Disney+ x2 + YouTube Premium');
  });
});

describe('precios', () => {
  it('suma precio × cantidad', () => {
    expect(expectedPrice('Disney+ x2 + YouTube Premium', catalog)).toBe(16000);
    expect(expectedPrice('Netflix + Disney+ + Disney+', catalog)).toBe(19000);
  });

  it('sin precio si algo no está en el catálogo', () => {
    expect(expectedPrice('Disney+ + SUFF', catalog)).toBeNull();
    expect(priceOfItems([], catalog)).toBeNull();
  });
});

describe('planIncludes / renameInPlan / groupPlatforms', () => {
  it('detecta si el plan incluye una plataforma o combo', () => {
    expect(planIncludes('Disney+ x2 + YouTube Premium', 'Disney+', catalog)).toBe(true);
    expect(planIncludes('Netflix + Disney+', 'Disney+', catalog)).toBe(false);
    expect(planIncludes('Netflix + Disney+', 'Netflix + Disney+', catalog)).toBe(true);
  });

  it('renombra dentro de un plan compuesto conservando la cantidad', () => {
    expect(renameInPlan('Disney+ x2 + YouTube Premium', 'Disney+', 'Disney+ Premium', catalog)).toBe('Disney+ Premium x2 + YouTube Premium');
    expect(renameInPlan('Netflix', 'Disney+', 'Otro', catalog)).toBe('Netflix');
  });

  it('agrupa las plataformas repetidas de un combo', () => {
    expect(groupPlatforms(['Disney+', 'YouTube Premium', 'Disney+'])).toEqual([
      { nombre: 'Disney+', cantidad: 2 },
      { nombre: 'YouTube Premium', cantidad: 1 },
    ]);
  });
});
