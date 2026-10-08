import { describe, it, expect } from 'vitest';
import { computeStats } from '@/lib/stats';
import { makeClient } from '@/test/fakeSupabase';
import type { Payment } from '@/types/client';

const now = new Date(2026, 9, 7);
const payment = (fecha_pago: string, monto: number): Payment => ({
  id: `${fecha_pago}-${monto}`, client_id: null, cliente_nombre: 'X', plan: '', monto, medio: 'Efectivo',
  fecha_pago, vencimiento_anterior: null, vencimiento_nuevo: null,
});

describe('computeStats', () => {
  it('separa lo cobrado por mes y calcula la variación contra el mes anterior', () => {
    const stats = computeStats([], [payment('2026-10-01', 3000), payment('2026-10-07', 3000), payment('2026-09-15', 4000), payment('2026-05-01', 100)], now);

    expect(stats.cobradoMes).toBe(6000);
    expect(stats.pagosMes).toBe(2);
    expect(stats.variacion).toBe(50);
    expect(stats.meses.map(m => m.total)).toEqual([100, 0, 0, 0, 4000, 6000]);
    expect(stats.meses[5].label).toBe('oct');
  });

  it('sin cobros el mes anterior no inventa una variación', () => {
    expect(computeStats([], [payment('2026-10-01', 3000)], now).variacion).toBeNull();
  });

  it('una caída se informa en negativo', () => {
    expect(computeStats([], [payment('2026-10-01', 1000), payment('2026-09-01', 4000)], now).variacion).toBe(-75);
  });

  it('la eficiencia compara lo cobrado con lo que todavía hay para cobrar', () => {
    const clients = [
      makeClient({ id: 'hoy', dias: 0, total: 1000 }),
      makeClient({ id: 'vencido', dias: -30, total: 1000 }),
      makeClient({ id: 'perdido', dias: -31, total: 5000 }),
      makeClient({ id: 'aldia', dias: 10, total: 7000 }),
    ];
    const stats = computeStats(clients, [payment('2026-10-02', 6000)], now);

    expect(stats.porCobrar).toBe(2000);
    expect(stats.carteraVigente).toBe(8000);
    expect(stats.eficiencia).toBe(75);
  });

  it('sin cobros ni deuda no hay eficiencia que mostrar', () => {
    expect(computeStats([makeClient({ dias: 10 })], [], now).eficiencia).toBeNull();
  });

  it('los dados de baja no cuentan como vencidos ni como deuda', () => {
    const stats = computeStats([makeClient({ id: 'a', dias: -5, total: 1000, seguimiento: 'baja' }), makeClient({ id: 'b', dias: -5, total: 400 })], [], now);
    expect(stats.vencidos).toBe(1);
    expect(stats.porCobrar).toBe(400);
  });

  it('agrupa la cartera vigente por plataforma, de mayor a menor', () => {
    const stats = computeStats([
      makeClient({ id: '1', plan: 'Netflix', dias: 5, total: 1000 }),
      makeClient({ id: '2', plan: 'netflix', dias: 9, total: 1000 }),
      makeClient({ id: '3', plan: 'HBO', dias: 5, total: 5000 }),
      makeClient({ id: '4', plan: '', dias: 5, total: 10 }),
      makeClient({ id: '5', plan: 'HBO', dias: -5, total: 99999 }),
    ], [], now);

    expect(stats.plataformas).toEqual([
      { plan: 'HBO', total: 5000, clientes: 1 },
      { plan: 'Netflix', total: 2000, clientes: 2 },
      { plan: 'Sin plan', total: 10, clientes: 1 },
    ]);
  });

  it('activos son todos los que tienen el plan vigente; vencidos solo los de 1 a 30 días', () => {
    const clients = [4, 30, 3, 1, 0, 0, -1, -30, -31, -45].map((dias, i) => makeClient({ id: String(i), dias }));
    const stats = computeStats(clients, [], now);

    expect(stats).toMatchObject({ activos: 6, porVencer: 2, vencenHoy: 2, vencidos: 2, enRecuperacion: 2 });
  });

  it('por cobrar suma exactamente a los que vencen hoy y a los vencidos de la tarjeta', () => {
    const clients = [
      makeClient({ id: 'hoy', dias: 0, total: 100 }),
      makeClient({ id: 'pronto', dias: 2, total: 1000 }),
      makeClient({ id: 'vencido', dias: -10, total: 10 }),
      makeClient({ id: 'perdido', dias: -40, total: 5000 }),
    ];
    expect(computeStats(clients, [], now).porCobrar).toBe(110);
  });
});
