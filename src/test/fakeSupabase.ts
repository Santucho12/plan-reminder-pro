import { addDays, format } from 'date-fns';
import type { Client } from '@/types/client';

type Row = Record<string, any>;
type Failure = { message: string; code?: string };
/** Falla fija, o según los datos enviados / columnas pedidas (null = no falla). */
type FailureRule = Failure | ((payload: any, columns: string) => Failure | null);

/** Fecha 'yyyy-MM-dd' a `offset` días de hoy (negativo = pasado). */
export const dayOffset = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');

/** Cliente tal como lo maneja la UI (con `dias` ya calculado). */
export function makeClient(overrides: Partial<Client> = {}): Client {
  const dias = Number(overrides.dias ?? 0);
  return {
    id: 'c1',
    nombre: 'Juan Pérez',
    celular: '5492915371541',
    plan: 'Netflix',
    vencimiento: addDays(new Date(), dias),
    total: 15000,
    estado: 'Vence hoy',
    dias,
    ...overrides,
  };
}

/** Fila de la tabla `clients` tal como está en la base. */
export function makeRow(overrides: Row = {}): Row {
  return {
    id: 'c1',
    user_id: 'u1',
    nombre: 'Juan Pérez',
    celular: '5492915371541',
    plan: 'Netflix',
    vencimiento: dayOffset(0),
    total: 15000,
    estado: 'pendiente',
    dias: 0,
    ultimo_mensaje: null,
    ...overrides,
  };
}

/**
 * Supabase en memoria: implementa la parte del query builder que usa la app
 * (select / insert / update / delete con eq, in, order, range, limit, single, maybeSingle)
 * para poder probar la capa de datos real sin red.
 */
export function createFakeSupabase(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { clients: [], user_configs: [] };
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map(r => ({ ...r }));

  /** Errores forzados por operación, ej: failures['clients.insert'] = { message: 'boom' } */
  const failures: Record<string, FailureRule> = {};
  /** Registro de operaciones ejecutadas, en orden, ej: 'clients.insert' */
  const log: string[] = [];
  const state = {
    session: { user: { id: 'u1', email: 'test@test.com' } } as any,
    authListeners: [] as any[],
    /** Workspace que devuelve current_workspace; undefined = el id del usuario logueado. */
    workspaceId: undefined as string | null | undefined,
    members: [
      { user_id: 'u1', email: 'test@test.com', rol: 'admin', clave: '12345678' },
      { user_id: 'u2', email: 'usuario@test.com', rol: 'usuario', clave: 'actual123' as string | null },
    ] as { user_id: string; email: string; rol: string; clave: string | null }[],
    /** Cuerpos recibidos por la función manage-user. */
    invocations: [] as any[],
  };

  class Query {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: any;
    private filters: ((row: Row) => boolean)[] = [];
    private orders: { col: string; asc: boolean }[] = [];
    private window: [number, number] | null = null;
    private max: number | null = null;
    private mode: 'many' | 'single' | 'maybeSingle' = 'many';
    private columns = '*';

    constructor(private table: string) {}

    select(columns = '*') { if (this.op === 'select') this.columns = columns; return this; }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
    update(values: Row) { this.op = 'update'; this.payload = values; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(col: string, value: any) { this.filters.push(r => r[col] === value); return this; }
    in(col: string, values: any[]) { this.filters.push(r => values.includes(r[col])); return this; }
    order(col: string, opts: { ascending?: boolean } = {}) { this.orders.push({ col, asc: opts.ascending !== false }); return this; }
    range(from: number, to: number) { this.window = [from, to]; return this; }
    limit(n: number) { this.max = n; return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybeSingle'; return this; }

    then(resolve: (value: any) => any, reject?: (reason: any) => any) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }

    private run() {
      const key = `${this.table}.${this.op}`;
      log.push(key);
      const rule = failures[key];
      const failure = typeof rule === 'function' ? rule(this.payload, this.columns) : rule;
      if (failure) return { data: null, error: failure };

      const rows = tables[this.table] ?? (tables[this.table] = []);
      const matches = (r: Row) => this.filters.every(f => f(r));
      let result: Row[];

      if (this.op === 'insert') {
        result = this.payload.map((r: Row) => ({ ...r }));
        rows.push(...result);
      } else if (this.op === 'update') {
        result = rows.filter(matches);
        result.forEach(r => Object.assign(r, this.payload));
      } else if (this.op === 'delete') {
        result = rows.filter(matches);
        tables[this.table] = rows.filter(r => !matches(r));
      } else {
        result = rows.filter(matches);
        for (const { col, asc } of [...this.orders].reverse()) {
          result = [...result].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
        }
        if (this.window) result = result.slice(this.window[0], this.window[1] + 1);
        if (this.max !== null) result = result.slice(0, this.max);
      }

      const data = result.map(r => ({ ...r }));
      if (this.mode === 'single') {
        return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'No se encontró exactamente una fila' } };
      }
      if (this.mode === 'maybeSingle') {
        return data.length <= 1 ? { data: data[0] ?? null, error: null } : { data: null, error: { message: 'Más de una fila' } };
      }
      return { data, error: null };
    }
  }

  const channel: any = { on: () => channel, subscribe: () => channel };

  const rpc = async (name: string) => {
    log.push(`rpc.${name}`);
    const rule = failures[`rpc.${name}`];
    const failure = typeof rule === 'function' ? rule(null, '') : rule;
    if (failure) return { data: null, error: failure };
    if (name === 'current_workspace') {
      return { data: state.workspaceId === undefined ? state.session?.user.id ?? null : state.workspaceId, error: null };
    }
    if (name === 'list_members') return { data: state.members.map(m => ({ ...m })), error: null };
    return { data: null, error: { code: 'PGRST202', message: `function ${name} not found` } };
  };

  /** Simula la Edge Function manage-user: cambia mail/contraseña del usuario configurable. */
  const invoke = async (name: string, { body }: { body: any }) => {
    log.push(`functions.${name}`);
    state.invocations.push(body);
    const rule = failures[`functions.${name}`];
    const failure = typeof rule === 'function' ? rule(body, '') : rule;
    if (failure) {
      return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: failure.message }) } } };
    }
    const usuario = state.members.find(m => m.rol === 'usuario')!;
    if (body.email) usuario.email = body.email;
    if (body.password) usuario.clave = body.password;
    return { data: { email: usuario.email }, error: null };
  };

  const client = {
    from: (table: string) => new Query(table),
    rpc,
    functions: { invoke },
    channel: () => channel,
    removeChannel: () => {},
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: (cb: any) => {
        state.authListeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        if (password !== 'correcta') return { data: null, error: { message: 'Invalid login credentials' } };
        state.session = { user: { id: 'u1', email } };
        state.authListeners.forEach(cb => cb('SIGNED_IN', state.session));
        return { data: state.session, error: null };
      },
      signOut: async () => {
        state.session = null;
        state.authListeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      },
    },
  };

  return { client, tables, failures, log, state };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;
