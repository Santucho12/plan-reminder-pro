import { describe, it, expect, beforeEach, vi } from 'vitest';
import { format } from 'date-fns';
import { createFakeSupabase, dayOffset, makeClient, makeRow, type FakeSupabase } from '@/test/fakeSupabase';

const h = vi.hoisted(() => ({ fake: null as any, writeFile: null as any }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => h.fake.client.from(table),
    rpc: (name: string) => h.fake.client.rpc(name),
    functions: { invoke: (name: string, opts: any) => h.fake.client.functions.invoke(name, opts) },
  },
}));

vi.mock('xlsx-js-style', async (importOriginal) => {
  const mod: any = await importOriginal();
  const real = mod.default ?? mod;
  return { ...mod, default: { ...real, writeFile: (...args: any[]) => h.writeFile(...args) } };
});

import {
  cleanPhone,
  computeEstado,
  createClient,
  deleteClient,
  exportClientsToExcel,
  fetchClients,
  fetchMembers,
  fetchSettingsJson,
  fetchWorkspaceId,
  SCHEMA_PENDING_MESSAGE,
  addClientEvent,
  applyImport,
  buildImportPlan,
  computeRenewal,
  fetchClientEvents,
  fetchPayments,
  parseAmount,
  parseExcelDate,
  parseImportRows,
  previewImport,
  registerPayment,
  undoPayment,
  updateClient,
  updateClientsTotal,
  saveSettingsJson,
  updateConfigurableUser,
} from '@/lib/api';

let fake: FakeSupabase;
const mapping = { nombre: 'Clientes', celular: 'Telefono', plan: 'Plataformas', vencimiento: 'Vencimiento', total: 'Total' };

beforeEach(() => {
  fake = createFakeSupabase();
  h.fake = fake;
  h.writeFile = vi.fn();
});

describe('cleanPhone', () => {
  it.each([
    ['2915371541', '5492915371541'],
    ['291 537-1541', '5492915371541'],
    ['(0291) 537-1541', '5492915371541'],
    ['542915371541', '5492915371541'],
    ['+54 9 291 537-1541', '5492915371541'],
    ['5492915371541', '5492915371541'],
    ['1123456789', '5491123456789'],
    [2915371541, '5492915371541'],
  ])('%s -> %s', (input, expected) => {
    expect(cleanPhone(input)).toBe(expected);
  });

  it('devuelve null si no hay dato', () => {
    expect(cleanPhone('')).toBeNull();
    expect(cleanPhone(null)).toBeNull();
    expect(cleanPhone(undefined)).toBeNull();
  });

  it('no inventa prefijos para números de otros países', () => {
    expect(cleanPhone('+598 99 123 456')).toBe('59899123456');
  });
});

describe('parseAmount', () => {
  it.each([
    ['15000', 15000],
    [15000, 15000],
    ['15.000', 15000],
    ['$ 15.000', 15000],
    ['1.250.000', 1250000],
    ['1.500,50', 1500.5],
    ['1,500.50', 1500.5],
    ['1500,5', 1500.5],
    ['1500.50', 1500.5],
    [99.9, 99.9],
    ['', 0],
    ['gratis', 0],
    [undefined, 0],
  ])('%s -> %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('parseExcelDate', () => {
  it.each([
    ['16/03/2026', '2026-03-16'],
    ['6/7/2026', '2026-07-06'],
    ['16-03-2026', '2026-03-16'],
    ['16.03.2026', '2026-03-16'],
    ['16/03/26', '2026-03-16'],
    ['03/16/2026', '2026-03-16'],
    ['2026-03-16', '2026-03-16'],
    ['2026/3/6', '2026-03-06'],
    ['46097', '2026-03-16'],
    ['45658', '2025-01-01'],
  ])('%s -> %s', (input, expected) => {
    expect(parseExcelDate(input)).toBe(expected);
  });

  it('si no puede leer la fecha usa la de hoy', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    expect(parseExcelDate('')).toBe(today);
    expect(parseExcelDate('no es fecha')).toBe(today);
    expect(parseExcelDate(undefined)).toBe(today);
  });
});

describe('computeEstado', () => {
  it.each([
    [0, 'Vence hoy'],
    [1, 'Por vencer'],
    [3, 'Por vencer'],
    [4, 'Activo'],
    [90, 'Activo'],
    [-1, 'Vencido'],
    [-200, 'Vencido'],
  ])('%i días -> %s', (dias, expected) => {
    expect(computeEstado(dias)).toBe(expected);
  });
});

describe('fetchClients', () => {
  it('calcula días y estado a partir del vencimiento', async () => {
    fake.tables.clients = [
      makeRow({ id: 'a', vencimiento: dayOffset(0) }),
      makeRow({ id: 'b', vencimiento: dayOffset(2) }),
      makeRow({ id: 'c', vencimiento: dayOffset(10) }),
      makeRow({ id: 'd', vencimiento: dayOffset(-5) }),
      makeRow({ id: 'e', vencimiento: dayOffset(-40) }),
    ];
    const byId = Object.fromEntries((await fetchClients('u1')).map(c => [c.id, c]));

    expect([byId.a.dias, byId.a.estado]).toEqual(['0', 'Vence hoy']);
    expect([byId.b.dias, byId.b.estado]).toEqual(['2', 'Por vencer']);
    expect([byId.c.dias, byId.c.estado]).toEqual(['10', 'Activo']);
    expect([byId.d.dias, byId.d.estado]).toEqual(['-5', 'Vencido']);
    expect([byId.e.dias, byId.e.estado]).toEqual(['-40', 'Vencido']);
  });

  it('un cliente guardado como "activo" igual pasa a vencido cuando se le vence el plan', async () => {
    fake.tables.clients = [
      makeRow({ id: 'a', estado: 'activo', vencimiento: dayOffset(-3) }),
      makeRow({ id: 'b', estado: 'activo', vencimiento: dayOffset(0) }),
    ];
    const clients = await fetchClients('u1');
    expect(clients.map(c => c.estado)).toEqual(['Vencido', 'Vence hoy']);
  });

  it('ignora el campo dias guardado en la base', async () => {
    fake.tables.clients = [makeRow({ dias: 99, vencimiento: dayOffset(1) })];
    expect((await fetchClients('u1'))[0].dias).toBe('1');
  });

  it('devuelve el vencimiento como fecha del día correcto y ordena por vencimiento', async () => {
    fake.tables.clients = [makeRow({ id: 'b', vencimiento: '2026-03-16' }), makeRow({ id: 'a', vencimiento: '2026-01-05' })];
    const clients = await fetchClients('u1');
    expect(clients.map(c => c.id)).toEqual(['a', 'b']);
    expect(format(clients[1].vencimiento, 'yyyy-MM-dd')).toBe('2026-03-16');
  });

  it('solo trae los clientes del usuario', async () => {
    fake.tables.clients = [makeRow({ id: 'mio' }), makeRow({ id: 'ajeno', user_id: 'otro' })];
    expect((await fetchClients('u1')).map(c => c.id)).toEqual(['mio']);
  });

  it('trae más de 1000 clientes (paginado)', async () => {
    fake.tables.clients = Array.from({ length: 2300 }, (_, i) => makeRow({ id: `c${String(i).padStart(5, '0')}` }));
    const clients = await fetchClients('u1');
    expect(clients).toHaveLength(2300);
    expect(new Set(clients.map(c => c.id)).size).toBe(2300);
  });

  it('propaga el error de la base', async () => {
    fake.failures['clients.select'] = { message: 'sin conexión' };
    await expect(fetchClients('u1')).rejects.toMatchObject({ message: 'sin conexión' });
  });
});

describe('importación desde Excel', () => {
  const rows = [
    { Clientes: ' Ana ', Telefono: '291 537-1541', Plataformas: 'Netflix', Vencimiento: '16/03/2026', Total: '$ 15.000' },
    { Clientes: 'Beto', Telefono: '', Plataformas: '', Vencimiento: '2026-04-01', Total: '2500,50' },
    { Clientes: '   ', Telefono: '111', Plataformas: 'x', Vencimiento: '01/01/2026', Total: '1' },
  ];
  const importAll = async (options?: { removeMissing?: boolean }) => applyImport(await previewImport(rows, mapping, 'u1'), 'u1', options);

  it('normaliza teléfono, fecha y monto y descarta las filas sin nombre', () => {
    expect(parseImportRows(rows, mapping)).toEqual([
      { nombre: 'Ana', celular: '5492915371541', plan: 'Netflix', vencimiento: '2026-03-16', total: 15000, dias: 0 },
      { nombre: 'Beto', celular: '', plan: '', vencimiento: '2026-04-01', total: 2500.5, dias: 0 },
    ]);
  });

  it('con la base vacía todos son nuevos y se guardan', async () => {
    const plan = await previewImport(rows, mapping, 'u1');
    expect(plan.nuevos).toHaveLength(2);
    expect(plan.modificados).toEqual([]);
    expect(fake.tables.clients).toHaveLength(0);

    expect(await applyImport(plan, 'u1')).toEqual({ creados: 2, actualizados: 0, eliminados: 0 });
    expect(fake.tables.clients[0]).toMatchObject({
      user_id: 'u1', nombre: 'Ana', celular: '5492915371541', plan: 'Netflix', vencimiento: '2026-03-16', total: 15000, estado: 'pendiente',
    });
    expect(new Set(fake.tables.clients.map(c => c.id)).size).toBe(2);
  });

  it('actualiza al cliente que ya existe (mismo celular) sin perder sus notas ni su historial', async () => {
    fake.tables.clients = [
      makeRow({ id: 'ana', nombre: 'Ana', celular: '5492915371541', plan: 'Netflix', vencimiento: '2026-02-16', total: 12000, nota_precio: 'Promo', ultimo_mensaje: '2026-02-10T10:00:00Z' }),
    ];
    const plan = await previewImport(rows, mapping, 'u1');

    expect(plan.nuevos.map(n => n.nombre)).toEqual(['Beto']);
    expect(plan.modificados).toEqual([{
      id: 'ana',
      nombre: 'Ana',
      updates: { vencimiento: '2026-03-16', total: 15000 },
      cambios: ['Vencimiento: 16/02/2026 → 16/03/2026', 'Total: $12.000 → $15.000'],
    }]);

    await applyImport(plan, 'u1');
    expect(fake.tables.clients.find(c => c.id === 'ana')).toMatchObject({
      vencimiento: '2026-03-16', total: 15000, nota_precio: 'Promo', ultimo_mensaje: '2026-02-10T10:00:00Z',
    });
    expect(fake.tables.clients).toHaveLength(2);
  });

  it('ignorando teléfonos y plataformas, los nuevos quedan sin esos datos y los existentes conservan los suyos', async () => {
    fake.tables.clients = [
      makeRow({ id: 'ana', nombre: 'Ana', celular: '5491100000001', plan: 'Netflix Premium', vencimiento: '2026-02-16', total: 12000 }),
    ];
    const options = { ignorePhone: true, ignorePlan: true };
    expect(parseImportRows(rows, mapping, options).map(r => [r.celular, r.plan])).toEqual([['', ''], ['', '']]);

    const plan = await previewImport(rows, mapping, 'u1', options);
    // Ana se cruza por nombre; su celular y su plan no se comparan ni se pisan
    expect(plan.modificados).toEqual([{
      id: 'ana', nombre: 'Ana',
      updates: { vencimiento: '2026-03-16', total: 15000 },
      cambios: ['Vencimiento: 16/02/2026 → 16/03/2026', 'Total: $12.000 → $15.000'],
    }]);
    expect(plan.nuevos).toEqual([{ nombre: 'Beto', celular: '', plan: '', vencimiento: '2026-04-01', total: 2500.5, dias: 0 }]);

    await applyImport(plan, 'u1');
    expect(fake.tables.clients.find(c => c.id === 'ana')).toMatchObject({ celular: '5491100000001', plan: 'Netflix Premium' });
  });

  it('volver a subir el mismo archivo no cambia nada', async () => {
    await importAll();
    const before = JSON.stringify(fake.tables.clients);
    const plan = await previewImport(rows, mapping, 'u1');

    expect(plan).toMatchObject({ nuevos: [], modificados: [], sinCambios: 2, ausentes: [], sinTotal: [], sinCelular: 1 });
    await applyImport(plan, 'u1');
    expect(JSON.stringify(fake.tables.clients)).toBe(before);
  });

  it('avisa de las filas sin total y sin teléfono', () => {
    const incoming = [
      { nombre: 'Ana', celular: '', plan: '', vencimiento: '2026-04-01', total: 0, dias: 0 },
      { nombre: 'Beto', celular: '5491100000000', plan: '', vencimiento: '2026-04-01', total: 100, dias: 0 },
    ];
    expect(buildImportPlan(incoming, [])).toMatchObject({ sinTotal: ['Ana'], sinCelular: 1 });
    // Si los teléfonos no se importan, que falten no es un aviso
    expect(buildImportPlan(incoming, [], { ignorePhone: true }).sinCelular).toBe(0);
  });

  it('traduce los códigos de plataforma y guarda lo escrito al lado como nota del cliente nuevo', () => {
    const rows = [{ Clientes: 'Ana', Telefono: '', Plataformas: 'NET 2 + MAX  ya pago, el 10/10 estirar', Vencimiento: '16/03/2026', Total: '1' }];
    expect(parseImportRows(rows, mapping)[0]).toMatchObject({ plan: 'Netflix x2 + Max', nota_plataforma: 'ya pago, el 10/10 estirar' });
    expect(parseImportRows(rows, mapping, { ignorePlan: true })[0]).toMatchObject({ plan: '' });
    expect(parseImportRows(rows, mapping, { ignorePlan: true })[0]).not.toHaveProperty('nota_plataforma');
  });

  it('sin celular cruza por nombre', () => {
    const plan = buildImportPlan(
      [{ nombre: 'beto', celular: '', plan: 'HBO', vencimiento: '2026-04-01', total: 100, dias: 0 }],
      [makeRow({ id: 'b', nombre: 'Beto', celular: '', plan: 'HBO', vencimiento: '2026-04-01', total: 100 })],
    );
    expect(plan.nuevos).toEqual([]);
    expect(plan.modificados.map(m => [m.id, m.updates])).toEqual([['b', { nombre: 'beto' }]]);
  });

  it('un mismo celular con dos planes se cruza plan con plan', () => {
    const existing = [
      makeRow({ id: 'n', celular: '5491100000000', plan: 'Netflix', vencimiento: '2026-01-01', total: 10 }),
      makeRow({ id: 'h', celular: '5491100000000', plan: 'HBO', vencimiento: '2026-01-01', total: 20 }),
    ];
    const plan = buildImportPlan([
      { nombre: 'Juan Pérez', celular: '5491100000000', plan: 'HBO', vencimiento: '2026-01-01', total: 25, dias: 0 },
      { nombre: 'Juan Pérez', celular: '5491100000000', plan: 'Netflix', vencimiento: '2026-01-01', total: 10, dias: 0 },
    ], existing);

    expect(plan.modificados.map(m => [m.id, m.updates])).toEqual([['h', { total: 25 }]]);
    expect(plan.sinCambios).toBe(1);
    expect(plan.ausentes).toEqual([]);
  });

  it('los que no vienen en el archivo se conservan salvo que se pida eliminarlos', async () => {
    fake.tables.clients = [makeRow({ id: 'viejo', nombre: 'Viejo', celular: '5491199999999' }), makeRow({ id: 'ajeno', user_id: 'otro' })];

    const plan = await previewImport(rows, mapping, 'u1');
    expect(plan.ausentes).toEqual([{ id: 'viejo', nombre: 'Viejo' }]);
    await applyImport(plan, 'u1');
    expect(fake.tables.clients.map(c => c.id)).toContain('viejo');

    const result = await importAll({ removeMissing: true });
    expect(result.eliminados).toBe(1);
    expect(fake.tables.clients.map(c => c.id)).not.toContain('viejo');
    expect(fake.tables.clients.map(c => c.id)).toContain('ajeno');
  });

  it('si falla el guardado no se borra ningún cliente', async () => {
    fake.tables.clients = [makeRow({ id: 'viejo', celular: '5491199999999' })];
    const plan = await previewImport(rows, mapping, 'u1');
    fake.failures['clients.insert'] = { message: 'fila inválida' };

    await expect(applyImport(plan, 'u1', { removeMissing: true })).rejects.toMatchObject({ message: 'fila inválida' });
    expect(fake.tables.clients.map(c => c.id)).toEqual(['viejo']);
    expect(fake.log).not.toContain('clients.delete');
  });

  it('informa si no puede actualizar o eliminar', async () => {
    fake.tables.clients = [makeRow({ id: 'ana', celular: '5492915371541', total: 1 }), makeRow({ id: 'viejo', celular: '5491199999999' })];
    const plan = await previewImport(rows, mapping, 'u1');

    fake.failures['clients.update'] = { message: 'sin permiso' };
    await expect(applyImport(plan, 'u1')).rejects.toMatchObject({ message: 'sin permiso' });
    delete fake.failures['clients.update'];

    fake.failures['clients.delete'] = { message: 'no se puede borrar' };
    await expect(applyImport({ ...plan, nuevos: [] }, 'u1', { removeMissing: true })).rejects.toMatchObject({ message: 'no se puede borrar' });
  });

  it('si el archivo no tiene filas válidas no toca la base', async () => {
    fake.tables.clients = [makeRow({ id: 'viejo1' })];
    await expect(previewImport([{ Clientes: '', Telefono: '1' }], mapping, 'u1')).rejects.toThrow(/no tiene filas/);
    expect(fake.tables.clients).toHaveLength(1);
    expect(fake.log).toEqual([]);
  });

  it('compara contra listas de más de 1000 clientes', async () => {
    fake.tables.clients = Array.from({ length: 1250 }, (_, i) => makeRow({ id: `v${String(i).padStart(5, '0')}`, nombre: `Cliente ${i}`, celular: `54911${String(i).padStart(8, '0')}` }));
    const plan = await previewImport(rows, mapping, 'u1');
    expect(plan.ausentes).toHaveLength(1250);
    expect(plan.nuevos).toHaveLength(2);
  });
});

describe('pagos y renovación', () => {
  const today = new Date(2026, 9, 7);

  it.each([
    ['vence más adelante: suma desde su vencimiento', new Date(2026, 9, 20), 1, '2026-11-20'],
    ['vence hoy: suma desde hoy', new Date(2026, 9, 7), 1, '2026-11-07'],
    ['ya vencido: suma desde hoy', new Date(2026, 8, 1), 1, '2026-11-07'],
    ['varios meses', new Date(2026, 9, 20), 3, '2027-01-20'],
    ['fin de mes sin día equivalente', new Date(2027, 0, 31), 1, '2027-02-28'],
  ])('%s', (_label, vencimiento, meses, expected) => {
    expect(computeRenewal(vencimiento, meses, today)).toBe(expected);
  });

  it('registra el pago y renueva al cliente', async () => {
    fake.tables.clients = [makeRow({ id: 'a', vencimiento: dayOffset(-5), estado: 'vencido' })];
    const client = makeClient({ id: 'a', nombre: 'Ana', plan: 'HBO', dias: -5 });

    const payment = await registerPayment('u1', client, { monto: 9000, medio: 'Efectivo', vencimientoNuevo: '2026-12-01' });

    expect(fake.tables.clients[0]).toMatchObject({ vencimiento: '2026-12-01', estado: 'activo' });
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.payments[0]).toMatchObject({
      user_id: 'u1', client_id: 'a', cliente_nombre: 'Ana', plan: 'HBO', monto: 9000, medio: 'Efectivo',
      fecha_pago: dayOffset(0), vencimiento_anterior: dayOffset(-5), vencimiento_nuevo: '2026-12-01',
    });
    expect(payment.id).toBe(fake.tables.payments[0].id);
  });

  it('si no puede renovar al cliente no deja el pago cargado', async () => {
    fake.tables.clients = [makeRow({ id: 'a' })];
    fake.failures['clients.update'] = { message: 'sin permiso' };

    await expect(registerPayment('u1', makeClient({ id: 'a' }), { monto: 1, medio: 'Efectivo', vencimientoNuevo: '2026-12-01' }))
      .rejects.toMatchObject({ message: 'sin permiso' });
    expect(fake.tables.payments).toEqual([]);
  });

  it('avisa claro cuando todavía no existe la tabla de pagos', async () => {
    fake.tables.clients = [makeRow({ id: 'a', vencimiento: '2026-01-01' })];
    fake.failures['payments.insert'] = { message: "Could not find the table 'public.payments' in the schema cache", code: 'PGRST205' } as any;

    await expect(registerPayment('u1', makeClient({ id: 'a' }), { monto: 1, medio: 'Efectivo', vencimientoNuevo: '2026-12-01' }))
      .rejects.toThrow(SCHEMA_PENDING_MESSAGE);
    expect(fake.tables.clients[0].vencimiento).toBe('2026-01-01');
  });

  it('trae solo los pagos del usuario, del más nuevo al más viejo', async () => {
    fake.tables.payments = [
      { id: 'p1', user_id: 'u1', fecha_pago: '2026-09-01', monto: '100.50' },
      { id: 'p2', user_id: 'u1', fecha_pago: '2026-10-01', monto: 200 },
      { id: 'p3', user_id: 'otro', fecha_pago: '2026-10-05', monto: 300 },
    ];
    const payments = await fetchPayments('u1');
    expect(payments.map(p => [p.id, p.monto])).toEqual([['p2', 200], ['p1', 100.5]]);
  });

  it('deshacer un pago lo borra y devuelve el vencimiento anterior', async () => {
    fake.tables.clients = [makeRow({ id: 'a', vencimiento: '2026-01-01' })];
    const payment = await registerPayment('u1', makeClient({ id: 'a', vencimiento: new Date(2026, 0, 1) }), { monto: 1, medio: 'Efectivo', vencimientoNuevo: '2026-02-01' });

    await undoPayment(payment);

    expect(fake.tables.payments).toEqual([]);
    expect(fake.tables.clients[0].vencimiento).toBe('2026-01-01');
  });

  it('deshacer un pago viejo no pisa una renovación posterior', async () => {
    fake.tables.clients = [makeRow({ id: 'a', vencimiento: '2026-01-01' })];
    const payment = await registerPayment('u1', makeClient({ id: 'a', vencimiento: new Date(2026, 0, 1) }), { monto: 1, medio: 'Efectivo', vencimientoNuevo: '2026-02-01' });
    fake.tables.clients[0].vencimiento = '2026-03-01';

    await undoPayment(payment);

    expect(fake.tables.payments).toEqual([]);
    expect(fake.tables.clients[0].vencimiento).toBe('2026-03-01');
  });
});

describe('historial del cliente y precios', () => {
  it('guarda notas y las devuelve de la más nueva a la más vieja', async () => {
    fake.tables.client_events = [{ id: 'e0', user_id: 'u1', client_id: 'a', tipo: 'mensaje', detalle: 'Viejo', created_at: '2020-01-01T00:00:00Z' }];
    const event = await addClientEvent('u1', 'a', 'nota', 'Prometió pagar el viernes');

    expect(fake.tables.client_events[1]).toMatchObject({ user_id: 'u1', client_id: 'a', tipo: 'nota', detalle: 'Prometió pagar el viernes' });
    expect((await fetchClientEvents('a')).map(e => e.id)).toEqual([event.id, 'e0']);
    expect(await fetchClientEvents('otro-cliente')).toEqual([]);
  });

  it('sin la tabla de historial la ficha queda vacía en vez de romperse', async () => {
    fake.failures['client_events.select'] = { message: 'relation does not exist', code: '42P01' } as any;
    expect(await fetchClientEvents('a')).toEqual([]);
  });

  it('cambia el importe solo de los clientes indicados', async () => {
    fake.tables.clients = [makeRow({ id: 'a', total: 1 }), makeRow({ id: 'b', total: 1 }), makeRow({ id: 'c', total: 1 })];
    await updateClientsTotal(['a', 'c'], 500);
    expect(fake.tables.clients.map(c => c.total)).toEqual([500, 1, 500]);
  });
});

describe('createClient / updateClient / deleteClient', () => {
  it('crea el cliente para el usuario con el teléfono normalizado', async () => {
    const created = await createClient('u1', { nombre: 'Ana', celular: '2915371541', plan: 'HBO', vencimiento: '2026-05-01', total: 100 });
    expect(created).toMatchObject({ user_id: 'u1', nombre: 'Ana', celular: '5492915371541', dias: 0 });
    expect(created.id).toBeTruthy();
    expect(fake.tables.clients).toHaveLength(1);
  });

  it('propaga el error al crear', async () => {
    fake.failures['clients.insert'] = { message: 'duplicado' };
    await expect(createClient('u1', { nombre: 'Ana' })).rejects.toMatchObject({ message: 'duplicado' });
  });

  it('actualiza solo el cliente indicado', async () => {
    fake.tables.clients = [makeRow({ id: 'a' }), makeRow({ id: 'b' })];
    await updateClient('a', { nombre: 'Nuevo', celular: '291 537 1541', total: 5 });
    expect(fake.tables.clients[0]).toMatchObject({ nombre: 'Nuevo', celular: '5492915371541', total: 5 });
    expect(fake.tables.clients[1].nombre).toBe('Juan Pérez');
  });

  it.each([
    ['Activo', 'activo'],
    ['Pagado', 'activo'],
    ['Vence hoy', 'vencido'],
    ['Vencido', 'vencido'],
    ['Por vencer', 'pendiente'],
    ['cualquier cosa', 'pendiente'],
  ])('guarda el estado "%s" como "%s" (valores que acepta la base)', async (shown, stored) => {
    fake.tables.clients = [makeRow({ id: 'a' })];
    await updateClient('a', { estado: shown });
    expect(fake.tables.clients[0].estado).toBe(stored);
  });

  it('registra la fecha del último mensaje sin tocar el resto', async () => {
    fake.tables.clients = [makeRow({ id: 'a', estado: 'pendiente' })];
    await updateClient('a', { ultimo_mensaje: '2026-10-07T12:00:00.000Z' });
    expect(fake.tables.clients[0]).toMatchObject({ ultimo_mensaje: '2026-10-07T12:00:00.000Z', estado: 'pendiente', nombre: 'Juan Pérez' });
  });

  it('falla si el cliente a actualizar no existe', async () => {
    await expect(updateClient('no-existe', { nombre: 'x' })).rejects.toBeTruthy();
  });

  it('elimina solo el cliente indicado', async () => {
    fake.tables.clients = [makeRow({ id: 'a' }), makeRow({ id: 'b' })];
    await deleteClient('a');
    expect(fake.tables.clients.map(c => c.id)).toEqual(['b']);
  });

  it('propaga el error al eliminar', async () => {
    fake.failures['clients.delete'] = { message: 'sin permiso' };
    await expect(deleteClient('a')).rejects.toMatchObject({ message: 'sin permiso' });
  });
});

describe('configuración del usuario', () => {
  const missingColumn = { code: '42703', message: 'column user_configs.settings does not exist' };

  it('devuelve null si el usuario todavía no tiene configuración', async () => {
    expect(await fetchSettingsJson('u1')).toBeNull();
  });

  it('crea la fila la primera vez que se guarda', async () => {
    await saveSettingsJson('u1', { version: 1 });
    expect(fake.tables.user_configs).toHaveLength(1);
    expect(fake.tables.user_configs[0]).toMatchObject({ user_id: 'u1', settings: { version: 1 } });
  });

  it('actualiza la fila existente sin duplicarla ni pisar otros campos', async () => {
    fake.tables.user_configs = [{ id: 'cfg', user_id: 'u1', settings: { version: 1, a: 1 }, otro: 'x' }, { id: 'x', user_id: 'otro', settings: { z: 1 } }];
    await saveSettingsJson('u1', { version: 1, a: 2 });

    expect(fake.tables.user_configs).toHaveLength(2);
    expect(fake.tables.user_configs[0]).toMatchObject({ id: 'cfg', settings: { version: 1, a: 2 }, otro: 'x' });
    expect(fake.tables.user_configs[1].settings).toEqual({ z: 1 });
    expect(await fetchSettingsJson('u1')).toEqual({ version: 1, a: 2 });
  });

  it('propaga el error al guardar', async () => {
    fake.failures['user_configs.update'] = { message: 'sin permiso' };
    await expect(saveSettingsJson('u1', { version: 1 })).rejects.toMatchObject({ message: 'sin permiso' });
  });

  it('sin la migración aplicada lee y guarda en la columna vieja', async () => {
    fake.tables.user_configs = [{ id: 'cfg', user_id: 'u1', msg_recordatorio: '{"version":1}' }];
    fake.failures['user_configs.select'] = (_payload, columns) => (columns === 'settings' ? missingColumn : null);
    fake.failures['user_configs.update'] = (payload) => ('settings' in payload ? missingColumn : null);

    expect(await fetchSettingsJson('u1')).toBe('{"version":1}');
    await saveSettingsJson('u1', { version: 1, b: 2 });
    expect(fake.tables.user_configs[0].msg_recordatorio).toBe('{"version":1,"b":2}');
    expect(fake.tables.user_configs[0]).not.toHaveProperty('settings');
  });
});

describe('usuarios y workspace compartido', () => {
  it('devuelve el workspace compartido del usuario logueado', async () => {
    fake.state.workspaceId = 'admin-id';
    expect(await fetchWorkspaceId('u2')).toBe('admin-id');
  });

  it('devuelve null si el usuario no es miembro', async () => {
    fake.state.workspaceId = null;
    expect(await fetchWorkspaceId('u9')).toBeNull();
  });

  it('sin la migración de usuarios cada uno usa sus propias filas', async () => {
    fake.failures['rpc.current_workspace'] = { code: 'PGRST202', message: 'function not found' };
    expect(await fetchWorkspaceId('u1')).toBe('u1');
  });

  it('propaga otros errores al buscar el workspace', async () => {
    fake.failures['rpc.current_workspace'] = { message: 'sin conexión' };
    await expect(fetchWorkspaceId('u1')).rejects.toMatchObject({ message: 'sin conexión' });
  });

  it('lista el admin y el usuario configurable', async () => {
    expect((await fetchMembers()).map(m => m.rol)).toEqual(['admin', 'usuario']);
  });

  it('cambia mail y contraseña del usuario configurable', async () => {
    expect(await updateConfigurableUser({ email: 'nuevo@test.com', password: 'secreta123' })).toBe('nuevo@test.com');
    expect(fake.state.invocations).toEqual([{ email: 'nuevo@test.com', password: 'secreta123' }]);
  });

  it('muestra el mensaje de error que devuelve el servidor', async () => {
    fake.failures['functions.manage-user'] = { message: 'Ese mail ya está en uso' };
    await expect(updateConfigurableUser({ email: 'admin@test.com' })).rejects.toMatchObject({ message: 'Ese mail ya está en uso' });
  });

  it('si el gateway rechaza la sesión (401 sin detalle de la función) lo explica', async () => {
    h.fake.client.functions.invoke = async () => ({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { status: 401, json: async () => ({ code: 401, message: 'Invalid JWT' }) } },
    });
    await expect(updateConfigurableUser({ email: 'nuevo@test.com' })).rejects.toMatchObject({ message: expect.stringMatching(/rechazó tu sesión/) });
  });
});

describe('exportClientsToExcel', () => {
  it('genera la planilla con encabezados y una fila por cliente', () => {
    exportClientsToExcel([
      makeClient({ nombre: 'Ana', celular: '5492915371541', plan: 'Netflix', vencimiento: new Date(2026, 2, 16), total: 15000, estado: 'Vence hoy', dias: 0 }),
      makeClient({ id: 'c2', nombre: 'Beto', vencimiento: new Date(2026, 6, 6), total: 99.5, estado: 'vencido', dias: -4 }),
    ]);

    expect(h.writeFile).toHaveBeenCalledTimes(1);
    const [workbook, fileName] = h.writeFile.mock.calls[0];
    const sheet = workbook.Sheets.Clientes;
    const cell = (ref: string) => sheet[ref]?.v;

    expect(fileName).toMatch(/^clientes_\d{2}-\d{2}-\d{4}\.xlsx$/);
    expect(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].map(cell)).toEqual(['Nombre', 'Celular', 'Plan', 'Vencimiento', 'Total', 'Estado', 'Días']);
    expect(['A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2'].map(cell)).toEqual(['Ana', '5492915371541', 'Netflix', '16/3/2026', 15000, 'Vence hoy', 0]);
    expect(['A3', 'D3', 'E3', 'F3', 'G3'].map(cell)).toEqual(['Beto', '6/7/2026', 99.5, 'Vencido', -4]);
  });

  it('la fecha exportada se vuelve a importar como el mismo día', () => {
    exportClientsToExcel([makeClient({ vencimiento: new Date(2026, 6, 6) })]);
    const sheet = h.writeFile.mock.calls[0][0].Sheets.Clientes;
    expect(parseExcelDate(sheet.D2.v)).toBe('2026-07-06');
  });

  it('exporta aunque no haya clientes', () => {
    exportClientsToExcel([]);
    expect(h.writeFile.mock.calls[0][0].Sheets.Clientes.A1.v).toBe('Nombre');
  });
});
