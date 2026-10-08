import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createFakeSupabase, dayOffset, makeRow, type FakeSupabase } from '@/test/fakeSupabase';

const h = vi.hoisted(() => ({
  fake: null as any,
  writeFile: null as any,
  toast: { success: null as any, error: null as any, warning: null as any },
}));

// La app corre completa contra una base en memoria: solo se reemplaza el cliente de Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => h.fake.client.from(table),
    rpc: (name: string) => h.fake.client.rpc(name),
    functions: { invoke: (name: string, opts: any) => h.fake.client.functions.invoke(name, opts) },
    channel: () => h.fake.client.channel(),
    removeChannel: () => {},
    auth: {
      getSession: () => h.fake.client.auth.getSession(),
      onAuthStateChange: (cb: any) => h.fake.client.auth.onAuthStateChange(cb),
      signInWithPassword: (credentials: any) => h.fake.client.auth.signInWithPassword(credentials),
      signOut: () => h.fake.client.auth.signOut(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => h.toast.success(...args),
    error: (...args: any[]) => h.toast.error(...args),
    warning: (...args: any[]) => h.toast.warning(...args),
  },
}));

vi.mock('xlsx-js-style', async (importOriginal) => {
  const mod: any = await importOriginal();
  const real = mod.default ?? mod;
  return { ...mod, default: { ...real, writeFile: (...args: any[]) => h.writeFile(...args) } };
});

import * as XLSX from 'xlsx';
import Index from '@/pages/Index';
import { DEFAULT_TEMPLATES, parseSettings } from '@/lib/whatsapp';

let fake: FakeSupabase;

const seed = () => [
  makeRow({ id: 'hoy', nombre: 'Hoy Uno', vencimiento: dayOffset(0), total: 1000, plan: 'Netflix' }),
  makeRow({ id: 'pronto', nombre: 'Pronto Dos', vencimiento: dayOffset(2), total: 2000, plan: 'HBO' }),
  makeRow({ id: 'aldia', nombre: 'Al Día', vencimiento: dayOffset(20), total: 9000, plan: 'Netflix' }),
  makeRow({ id: 'vencido', nombre: 'Vencido Tres', vencimiento: dayOffset(-10), total: 3000, plan: 'Spotify' }),
  makeRow({ id: 'perdido', nombre: 'Perdido Cuatro', vencimiento: dayOffset(-45), total: 4000, plan: 'Spotify', celular: '' }),
  makeRow({ id: 'ajeno', user_id: 'otro', nombre: 'De Otro Usuario' }),
];

const goTo = (section: string) => fireEvent.click(screen.getByRole('button', { name: section }));
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
const rowOf = (name: string) => within(screen.getByText(name).closest('tr')!);

async function renderApp() {
  render(<Index />);
  await screen.findByRole('heading', { name: 'Panel de Control' });
}

beforeEach(() => {
  fake = createFakeSupabase({ clients: seed() });
  h.fake = fake;
  h.writeFile = vi.fn();
  h.toast.success = vi.fn();
  h.toast.error = vi.fn();
  h.toast.warning = vi.fn();
  vi.stubGlobal('open', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('acceso', () => {
  it('sin sesión muestra el login y no carga datos', async () => {
    fake.state.session = null;
    render(<Index />);

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText('Panel de Control')).not.toBeInTheDocument();
    expect(fake.log).not.toContain('clients.select');
  });

  it('con credenciales incorrectas muestra el error', async () => {
    fake.state.session = null;
    render(<Index />);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
    expect(screen.queryByText('Panel de Control')).not.toBeInTheDocument();
  });

  it('con credenciales correctas entra al panel con sus clientes', async () => {
    fake.state.session = null;
    render(<Index />);
    await screen.findByRole('heading', { name: 'Iniciar sesión' });

    fireEvent.change(screen.getByPlaceholderText('tu@email.com'), { target: { value: 'a@a.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'correcta' } });
    fireEvent.click(screen.getByRole('button', { name: /Ingresar/ }));

    expect(await screen.findByRole('heading', { name: 'Panel de Control' })).toBeInTheDocument();
    expect(await screen.findByText('Gestionando 5 clientes en el sistema.')).toBeInTheDocument();
  });

  it('cerrar sesión vuelve al login', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText('Hoy Uno')).not.toBeInTheDocument();
  });
});

describe('dashboard', () => {
  it('muestra solo los clientes del usuario y los que vencen hoy', async () => {
    await renderApp();

    expect(await screen.findByText('Gestionando 5 clientes en el sistema.')).toBeInTheDocument();
    expect(screen.getByText('Hoy Uno')).toBeInTheDocument();
    expect(screen.queryByText('Pronto Dos')).not.toBeInTheDocument();
    expect(screen.queryByText('De Otro Usuario')).not.toBeInTheDocument();
    expect(rowOf('Hoy Uno').getByText('Vence hoy')).toBeInTheDocument();
  });

  it('la pestaña de próximos 3 días muestra los que están por vencer', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');

    openTab(/Próximos 3 días/);

    expect(screen.getByText('Pronto Dos')).toBeInTheDocument();
    expect(rowOf('Pronto Dos').getByText('Por vencer')).toBeInTheDocument();
    expect(screen.queryByText('Hoy Uno')).not.toBeInTheDocument();
    expect(screen.queryByText('Al Día')).not.toBeInTheDocument();
  });

  it('sin clientes invita a cargar la base', async () => {
    fake.tables.clients = [];
    await renderApp();

    expect(screen.getByText('Comencemos la gestión.')).toBeInTheDocument();
    expect(screen.getByText(/comenzar a gestionar vencimientos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cargar Excel/ }));
    expect(screen.getByRole('heading', { name: 'Importación masiva' })).toBeInTheDocument();
  });

  it('avisa si no puede cargar los clientes', async () => {
    fake.failures['clients.select'] = { message: 'sin conexión' };
    await renderApp();
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Error al cargar clientes'));
  });

  it('no queda ninguna mención a automatización, bot ni Mercado Pago', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');

    for (const section of ['Dashboard', 'Clientes', 'Mensajes', 'Plataformas', 'Configuración']) {
      goTo(section);
      expect(document.body.textContent).not.toMatch(/automatiza|automático|bot (de|en|desconectado)|mercado pago|código qr/i);
    }
  });
});

describe('ayuda de cada pantalla', () => {
  it('el botón de info explica cada módulo y se cierra', async () => {
    await renderApp();
    const modules: [string | null, string][] = [
      [null, 'Cómo funciona el Dashboard'],
      ['Clientes', 'Cómo funciona Clientes'],
      ['Mensajes', 'Cómo funciona Mensajes'],
      ['Plataformas', 'Cómo funciona Plataformas'],
      ['Configuración', 'Cómo funciona Configuración'],
    ];
    for (const [section, title] of modules) {
      if (section) goTo(section);
      fireEvent.click(await screen.findByRole('button', { name: 'Cómo funciona esta pantalla' }));
      expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).not.toBeInTheDocument());
    }
  });

  it('se cierra con Escape', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Cómo funciona esta pantalla' }));
    expect(screen.getByRole('dialog', { name: 'Cómo funciona el Dashboard' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cómo funciona el Dashboard' })).not.toBeInTheDocument());
  });
});

describe('gestión de clientes', () => {
  async function openClients() {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    await screen.findByText('Al Día');
  }

  it('lista todos los clientes ordenados por monto', async () => {
    await openClients();
    const names = screen.getAllByRole('row').slice(1).map(r => r.querySelector('td button[title="Ver ficha"]')?.textContent?.trim());
    expect(names).toEqual(['Al Día', 'Perdido Cuatro', 'Vencido Tres', 'Pronto Dos', 'Hoy Uno']);
    expect(rowOf('Al Día').getByText('Activo')).toBeInTheDocument();
    expect(rowOf('Vencido Tres').getByText('Vencido')).toBeInTheDocument();
  });

  it('busca por nombre sin distinguir mayúsculas', async () => {
    await openClients();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'venc' } });

    expect(screen.getByText('Vencido Tres')).toBeInTheDocument();
    expect(screen.queryByText('Al Día')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No se encontraron clientes')).toBeInTheDocument();
  });

  it('crea un cliente nuevo y aparece en la lista', async () => {
    await openClients();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo Cliente/ }));

    fireEvent.change(screen.getByPlaceholderText('Ej: Juan Pérez'), { target: { value: 'Cliente Nuevo' } });
    fireEvent.change(screen.getByPlaceholderText('549...'), { target: { value: '291 537-1541' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Netflix 4K'), { target: { value: 'Disney' } });
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: dayOffset(0) } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '777' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear Cliente/ }));

    expect(await screen.findByText('Cliente Nuevo')).toBeInTheDocument();
    expect(h.toast.success).toHaveBeenCalledWith('Cliente creado correctamente');
    expect(fake.tables.clients.find(c => c.nombre === 'Cliente Nuevo')).toMatchObject({
      user_id: 'u1', celular: '5492915371541', plan: 'Disney', vencimiento: dayOffset(0), total: 777,
    });
    // Recién creado y vence hoy: tiene que figurar como tal, no como "activo"
    expect(rowOf('Cliente Nuevo').getByText('Vence hoy')).toBeInTheDocument();
    expect(screen.queryByText('Crear Cliente')).not.toBeInTheDocument();
  });

  it('editar el vencimiento (renovación) actualiza el estado del cliente', async () => {
    await openClients();
    fireEvent.click(rowOf('Vencido Tres').getByTitle('Editar'));

    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Vencido Tres');
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: dayOffset(30) } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Cliente actualizado correctamente'));
    expect(fake.tables.clients.find(c => c.id === 'vencido')!.vencimiento).toBe(dayOffset(30));
    await waitFor(() => expect(rowOf('Vencido Tres').getByText('Activo')).toBeInTheDocument());
  });

  it('si falla el guardado avisa y no cierra el formulario', async () => {
    await openClients();
    fireEvent.click(rowOf('Hoy Uno').getByTitle('Editar'));
    fake.failures['clients.update'] = { message: 'falló' };
    fireEvent.change(screen.getByPlaceholderText('Ej: Juan Pérez'), { target: { value: 'Nombre Editado' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Error al guardar cliente'));
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Nombre Editado');
    expect(fake.tables.clients.find(c => c.id === 'hoy')!.nombre).toBe('Hoy Uno');
  });

  it('elimina un cliente solo si se confirma', async () => {
    await openClients();
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirm);

    fireEvent.click(rowOf('Hoy Uno').getByTitle('Eliminar'));
    expect(confirm).toHaveBeenCalled();
    expect(fake.tables.clients.some(c => c.id === 'hoy')).toBe(true);

    confirm.mockReturnValue(true);
    fireEvent.click(rowOf('Hoy Uno').getByTitle('Eliminar'));
    await waitFor(() => expect(screen.queryByText('Hoy Uno')).not.toBeInTheDocument());
    expect(fake.tables.clients.some(c => c.id === 'hoy')).toBe(false);
    expect(fake.tables.clients.some(c => c.id === 'ajeno')).toBe(true);
  });

  it('exporta a Excel todos los clientes', async () => {
    await openClients();
    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }));

    const sheet = h.writeFile.mock.calls[0][0].Sheets.Clientes;
    const names = [2, 3, 4, 5, 6].map(n => sheet[`A${n}`].v);
    expect(names.sort()).toEqual(['Al Día', 'Hoy Uno', 'Perdido Cuatro', 'Pronto Dos', 'Vencido Tres']);
    expect(sheet.A7).toBeUndefined();
  });

  it('el botón WhatsApp de la tabla abre la vista previa y envía por wa.me', async () => {
    await openClients();
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: /WhatsApp/ }));

    expect(screen.getByText('Vista previa del mensaje')).toBeInTheDocument();
    expect(screen.getByText(/Tú suscripción ya está vencida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar por WhatsApp/ }));

    const url = new URL((window.open as any).mock.calls[0][0]);
    expect(url.host + url.pathname).toBe('wa.me/5492915371541');
    expect(url.searchParams.get('text')).toContain('ya está vencida');
    await waitFor(() => expect(fake.tables.clients.find(c => c.id === 'vencido')!.ultimo_mensaje).toBeTruthy());
  });
});

describe('mensajes de WhatsApp', () => {
  async function openMessages() {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Mensajes');
    await screen.findByRole('tab', { name: /Recuperación/ });
  }

  it('agrupa a los clientes por situación', async () => {
    await openMessages();
    expect(screen.getByRole('tab', { name: /Vencen hoy/ })).toHaveTextContent('1');
    // Pronto Dos vence en 2 días y no recibió aviso
    expect(screen.getByRole('tab', { name: /Próximos 3 días/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /Vencidos/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /Recuperación/ })).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: /automatización/i })).not.toBeInTheDocument();
  });

  it('tocar WhatsApp deja registrado el envío y lo marca como enviado hoy', async () => {
    await openMessages();
    const link = screen.getByRole('link', { name: /WhatsApp/ });
    expect(link.getAttribute('href')).toContain('https://wa.me/5492915371541?text=');

    fireEvent.click(link);

    expect(await screen.findByText(/Enviado hoy/)).toBeInTheDocument();
    await waitFor(() => expect(fake.tables.clients.find(c => c.id === 'hoy')!.ultimo_mensaje).toBeTruthy());
    expect(fake.tables.clients.find(c => c.id === 'pronto')!.ultimo_mensaje).toBeNull();
  });

  it('la cola sigue abierta al volver a la pestaña después de abrir WhatsApp', async () => {
    await openMessages();
    fireEvent.click(screen.getByRole('button', { name: /Enviar en cola \(1\)/ }));
    const queue = () => within(screen.getByRole('dialog', { name: 'Cola de envío' }));
    expect(queue().getByText('Hoy Uno')).toBeInTheDocument();
    fireEvent.click(queue().getByRole('button', { name: /Enviar y seguir/ }));
    expect(window.open).toHaveBeenCalledTimes(1);

    // Al volver a la pestaña Supabase revalida la sesión y avisa SIGNED_IN con el mismo usuario
    await act(async () => {
      fake.state.authListeners.forEach(cb => cb('SIGNED_IN', { user: { id: 'u1', email: 'test@test.com' } }));
    });

    await waitFor(() => expect(fake.tables.clients.find(c => c.id === 'hoy')!.ultimo_mensaje).toBeTruthy());
    expect(queue().getByText(/1 de 1 enviados/)).toBeInTheDocument();
  });

  it('el cliente sin teléfono aparece pero sin link', async () => {
    await openMessages();
    openTab(/Recuperación/);
    expect(screen.getByText('Perdido Cuatro')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('editar una plantilla la guarda y pasa a usarse en el botón de WhatsApp', async () => {
    await openMessages();
    fireEvent.click(screen.getByRole('button', { name: /Editar en Plantillas/ }));
    const plantilla = within(screen.getByRole('region', { name: 'Plantilla Vence hoy' }));
    fireEvent.click(plantilla.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola [Nombre], hoy vence [Plan]: son $[Total]' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Mensaje guardado'));
    fireEvent.click(screen.getByRole('button', { name: /Envíos/ }));
    const url = new URL(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe('Hola Hoy Uno, hoy vence Netflix: son $1.000');

    const saved = parseSettings(fake.tables.user_configs[0].settings).templates;
    expect(saved.today).toBe('Hola [Nombre], hoy vence [Plan]: son $[Total]');
    expect(saved.expired).toBe(DEFAULT_TEMPLATES.expired);

    // También en la vista previa de la tabla de clientes
    goTo('Clientes');
    fireEvent.click(rowOf('Hoy Uno').getByRole('button', { name: /WhatsApp/ }));
    expect(screen.getByText('Hola Hoy Uno, hoy vence Netflix: son $1.000')).toBeInTheDocument();
  });

  it('las plantillas guardadas se recuperan al volver a entrar', async () => {
    fake.tables.user_configs = [{
      id: 'cfg', user_id: 'u1',
      settings: { version: 1, templates: { expired: 'Texto propio para vencidos' } },
    }];
    await openMessages();
    openTab(/Vencidos/);

    expect(await screen.findByText('Texto propio para vencidos')).toBeInTheDocument();
    const url = new URL(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe('Texto propio para vencidos');
  });

  it('sin la migración aplicada usa la configuración guardada en la columna vieja', async () => {
    fake.tables.user_configs = [{
      id: 'cfg', user_id: 'u1',
      msg_recordatorio: JSON.stringify({ version: 1, templates: { expired: 'Texto viejo para vencidos' } }),
    }];
    fake.failures['user_configs.select'] = (_payload, columns) =>
      (columns === 'settings' ? { code: '42703', message: 'column user_configs.settings does not exist' } : null);
    await openMessages();
    openTab(/Vencidos/);
    expect(await screen.findByText('Texto viejo para vencidos')).toBeInTheDocument();
  });

  it('con textos viejos de la automatización en la base usa los predeterminados', async () => {
    fake.tables.user_configs = [{ id: 'cfg', user_id: 'u1', settings: 'Hola [Nombre] pagá acá [Link Mercado Pago]' }];
    await openMessages();
    expect(screen.getByText(/hoy vence tu suscripción/)).toBeInTheDocument();
    expect(screen.queryByText(/Link Mercado Pago/)).not.toBeInTheDocument();
  });

  it('si no se puede guardar la plantilla avisa y conserva el borrador', async () => {
    await openMessages();
    fake.failures['user_configs.update'] = { message: 'sin permiso' };
    fireEvent.click(screen.getByRole('button', { name: /Editar en Plantillas/ }));
    const plantilla = within(screen.getByRole('region', { name: 'Plantilla Vence hoy' }));
    fireEvent.click(plantilla.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudo guardar el mensaje'));
    expect(screen.getByRole('textbox')).toHaveValue('Borrador');
    // El borrador quedó sin guardar: al cambiar de pestaña pregunta antes
    fireEvent.click(screen.getByRole('button', { name: /Envíos/ }));
    fireEvent.click(within(screen.getByRole('alertdialog', { name: 'Tenés cambios sin guardar' })).getByRole('button', { name: 'Salir sin guardar' }));
    expect(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')).toContain(encodeURIComponent('hoy vence tu suscripción'));
  });
});

describe('pagos', () => {
  async function openClients() {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    await screen.findByText('Al Día');
  }

  it('registrar un pago renueva al cliente y queda en el historial de cobros', async () => {
    await openClients();
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: /Registrar pago de / }));

    const dialog = within(screen.getByRole('dialog', { name: 'Registrar pago' }));
    expect(dialog.getByLabelText('Monto cobrado')).toHaveValue(3000);
    fireEvent.change(dialog.getByLabelText('Nuevo vencimiento'), { target: { value: dayOffset(30) } });
    fireEvent.click(dialog.getByRole('button', { name: /Confirmar pago/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Pago registrado'));
    expect(fake.tables.clients.find(c => c.id === 'vencido')!.vencimiento).toBe(dayOffset(30));
    expect(fake.tables.payments).toHaveLength(1);
    expect(fake.tables.payments[0]).toMatchObject({ user_id: 'u1', client_id: 'vencido', monto: 3000, vencimiento_anterior: dayOffset(-10) });
    await waitFor(() => expect(rowOf('Vencido Tres').getByText('Activo')).toBeInTheDocument());

    fireEvent.click(dialog.getByRole('button', { name: 'Listo' }));
    goTo('Dashboard');
    expect(await screen.findByTestId('cobrado-mes')).toHaveTextContent('$3.000');
  });

  it('si el pago no se puede guardar avisa y no renueva', async () => {
    await openClients();
    fake.failures['payments.insert'] = { message: 'sin permiso' };
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: /Registrar pago de / }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('sin permiso'));
    expect(fake.tables.clients.find(c => c.id === 'vencido')!.vencimiento).toBe(dayOffset(-10));
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeInTheDocument();
  });

  it('el dashboard muestra lo cobrado y deja deshacer un pago', async () => {
    fake.tables.payments = [{
      id: 'p1', user_id: 'u1', client_id: 'aldia', cliente_nombre: 'Al Día', plan: 'Netflix', monto: 9000, medio: 'Efectivo',
      fecha_pago: dayOffset(0), vencimiento_anterior: dayOffset(-11), vencimiento_nuevo: dayOffset(20),
    }];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    await renderApp();

    expect(await screen.findByTestId('cobrado-mes')).toHaveTextContent('$9.000');
    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer pago de Al Día' }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Pago deshecho'));
    expect(fake.tables.payments).toEqual([]);
    expect(fake.tables.clients.find(c => c.id === 'aldia')!.vencimiento).toBe(dayOffset(-11));
    await waitFor(() => expect(screen.getByTestId('cobrado-mes')).toHaveTextContent('$0'));
  });

  it('si falta la tabla de pagos la app funciona igual y avisa que hay que actualizar la base', async () => {
    fake.failures['payments.select'] = { message: "Could not find the table 'public.payments' in the schema cache", code: 'PGRST205' } as any;
    await renderApp();

    expect(await screen.findByText('Hoy Uno')).toBeInTheDocument();
    expect(await screen.findByText(/Falta actualizar la base de datos/)).toBeInTheDocument();
    expect(h.toast.error).not.toHaveBeenCalled();
  });
});

describe('ficha del cliente', () => {
  async function openSheet(name: string) {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    await screen.findByText('Al Día');
    fireEvent.click(rowOf(name).getByTitle('Ver ficha'));
    return within(await screen.findByRole('dialog', { name: `Ficha de ${name}` }));
  }

  it('al hacer clic en el cliente se abre su detalle con el historial', async () => {
    fake.tables.client_events = [{ id: 'e1', user_id: 'u1', client_id: 'vencido', tipo: 'nota', detalle: 'Avisó que viaja', created_at: '2026-09-01T10:00:00Z' }];
    fake.tables.payments = [{ id: 'p1', user_id: 'u1', client_id: 'vencido', cliente_nombre: 'Vencido Tres', monto: 3000, medio: 'Efectivo', fecha_pago: '2026-08-01' }];
    const sheet = await openSheet('Vencido Tres');

    expect(sheet.getByText('Spotify')).toBeInTheDocument();
    expect(await sheet.findByText('Avisó que viaja')).toBeInTheDocument();
    expect(sheet.getByText('Pago de $3.000')).toBeInTheDocument();
  });

  it('la ficha no muestra el selector de seguimiento', async () => {
    const sheet = await openSheet('Hoy Uno');
    expect(sheet.queryByLabelText('Seguimiento')).not.toBeInTheDocument();
    expect(sheet.queryByText(/Sin seguimiento/)).not.toBeInTheDocument();
  });

  it('cada mensaje enviado queda en el historial del cliente', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Mensajes');
    fireEvent.click(await screen.findByRole('link', { name: /WhatsApp/ }));

    await waitFor(() => expect(fake.tables.client_events).toContainEqual(
      expect.objectContaining({ user_id: 'u1', client_id: 'hoy', tipo: 'mensaje', detalle: 'Plantilla: Vence hoy' }),
    ));
  });
});

describe('plataformas', () => {
  it('renombrar una plataforma con el lápiz renombra el plan de sus clientes', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Plataformas');

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Spotify' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar Spotify' }));
    fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: 'Spotify Premium' } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Catálogo guardado'));
    expect(fake.tables.clients.filter(c => ['vencido', 'perdido'].includes(c.id)).map(c => c.plan)).toEqual(['Spotify Premium', 'Spotify Premium']);
    expect(fake.tables.user_configs[0].settings.planes.map((p: any) => p.nombre)).toContain('Spotify Premium');
  });

  it('aplicar el precio del catálogo actualiza a los clientes del plan y ofrece avisar el aumento', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Plataformas');

    // Netflix tiene dos clientes con importes distintos (1.000 y 9.000)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Netflix' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar Netflix' }));
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '12000' } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));
    // El catálogo se guarda solo
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Catálogo guardado'));
    expect(fake.tables.user_configs[0].settings.planes).toContainEqual({ nombre: 'Netflix', precio: 12000 });

    fireEvent.click(screen.getByRole('button', { name: /Aplicar precios a \d+ clientes/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Precios actualizados'));
    expect(fake.tables.clients.filter(c => c.user_id === 'u1' && c.plan === 'Netflix').map(c => c.total)).toEqual([12000, 12000]);
    expect(fake.tables.clients.find(c => c.id === 'pronto')!.total).toBe(2000);
    expect(fake.tables.clients.find(c => c.id === 'ajeno')!.total).toBe(15000);
    expect(fake.tables.user_configs[0].settings.planes).toContainEqual({ nombre: 'Netflix', precio: 12000 });

    fireEvent.click(await screen.findByRole('button', { name: /Avisar el aumento por WhatsApp/ }));
    const queue = within(screen.getByRole('dialog', { name: 'Cola de envío' }));
    expect(queue.getByText(/el valor de Netflix pasa a ser de 💰 12.000/)).toBeInTheDocument();
  });
});

describe('configuración', () => {
  it('ofrece los datos de cobro y la carga de la base, sin integraciones externas', async () => {
    await renderApp();
    goTo('Configuración');

    expect(screen.getByRole('heading', { name: 'Configuración de Sistema' })).toBeInTheDocument();
    expect(screen.getByText('Base de Datos')).toBeInTheDocument();
    expect(screen.getByText('Datos de cobro')).toBeInTheDocument();
    expect(screen.queryByText(/Mercado Pago/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Credencial/i)).not.toBeInTheDocument();
  });

  it('los datos de cobro guardados pasan a usarse en los mensajes', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Configuración');

    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'nuevo.alias' } });
    fireEvent.change(screen.getByLabelText('CBU / CVU'), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Datos de cobro guardados'));

    goTo('Mensajes');
    const text = new URL((await screen.findByRole('link', { name: /WhatsApp/ })).getAttribute('href')!).searchParams.get('text')!;
    expect(text).toContain('cbu : 1234567890');
    expect(text).toContain('y alias : nuevo.alias');
  });

  it('avisa que faltan los datos de cobro hasta que se cargan', async () => {
    await renderApp();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Faltan tus datos de cobro');

    fireEvent.click(within(alert).getByRole('button', { name: 'Cargar datos de cobro' }));
    expect(screen.getByRole('heading', { name: 'Configuración de Sistema' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'mi.alias' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Datos de cobro guardados'));

    goTo('Dashboard');
    await screen.findByRole('heading', { name: 'Panel de Control' });
    expect(screen.queryByText('Faltan tus datos de cobro.')).not.toBeInTheDocument();
  });

  it('con datos de cobro cargados no muestra el aviso', async () => {
    fake.tables.user_configs = [{ id: 'cfg', user_id: 'u1', settings: { version: 1, cobro: { alias: 'ya.cargado' } } }];
    await renderApp();
    await screen.findByText('Hoy Uno');
    await waitFor(() => expect(fake.log).toContain('user_configs.select'));
    expect(screen.queryByText('Faltan tus datos de cobro.')).not.toBeInTheDocument();
  });
});

describe('usuarios', () => {
  it('el usuario configurable ve y carga los mismos datos que el admin', async () => {
    fake.state.session = { user: { id: 'u2', email: 'usuario@test.com' } };
    fake.state.workspaceId = 'u1';
    await renderApp();

    // Ve los clientes del workspace del admin (u1), no los de otro usuario
    expect(await screen.findByText('Gestionando 5 clientes en el sistema.')).toBeInTheDocument();
    goTo('Configuración');
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'compartido' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Datos de cobro guardados'));
    expect(fake.tables.user_configs[0]).toMatchObject({ user_id: 'u1' });
  });

  it('un usuario que no es miembro no ve datos', async () => {
    fake.state.workspaceId = null;
    render(<Index />);
    expect(await screen.findByRole('heading', { name: 'Tu usuario no tiene acceso' })).toBeInTheDocument();
    expect(fake.log).not.toContain('clients.select');
  });

  it('en Configuración muestra al admin fijo y permite cambiar el usuario configurable', async () => {
    await renderApp();
    goTo('Configuración');

    const accesos = within(await screen.findByRole('region', { name: 'Accesos' }));
    expect(await accesos.findByText('test@test.com')).toBeInTheDocument();
    expect(accesos.getByText(/no se pueden modificar/)).toBeInTheDocument();

    // La contraseña del admin se ve oculta y se muestra con el ojo
    const adminPassword = accesos.getByLabelText('Contraseña');
    expect(adminPassword).toHaveAttribute('type', 'password');
    expect(adminPassword).toHaveValue('12345678');
    fireEvent.click(accesos.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(adminPassword).toHaveAttribute('type', 'text');
    fireEvent.click(accesos.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(adminPassword).toHaveAttribute('type', 'password');
    expect(accesos.getByLabelText('Mail')).toHaveValue('usuario@test.com');

    fireEvent.change(accesos.getByLabelText('Mail'), { target: { value: 'nuevo@test.com' } });
    // La contraseña actual del usuario se ve oculta, con su propio ojo
    const actual = accesos.getByLabelText('Contraseña actual');
    expect(actual).toHaveValue('actual123');
    expect(actual).toHaveAttribute('type', 'password');
    fireEvent.click(accesos.getByRole('button', { name: 'Mostrar contraseña actual' }));
    expect(actual).toHaveAttribute('type', 'text');
    expect(accesos.queryByLabelText('Repetir contraseña')).not.toBeInTheDocument();

    fireEvent.change(accesos.getByLabelText('Contraseña nueva'), { target: { value: 'clave1234' } });
    fireEvent.click(accesos.getByRole('button', { name: /Guardar usuario/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Usuario actualizado'));
    expect(fake.state.invocations).toEqual([{ email: 'nuevo@test.com', password: 'clave1234' }]);
    expect(accesos.getByLabelText('Contraseña nueva')).toHaveValue('');
    // Después de guardar, la actual pasa a ser la nueva
    await waitFor(() => expect(accesos.getByLabelText('Contraseña actual')).toHaveValue('clave1234'));
  });

  it('valida la contraseña antes de enviar', async () => {
    await renderApp();
    goTo('Configuración');
    const accesos = within(await screen.findByRole('region', { name: 'Accesos' }));
    await accesos.findByText('test@test.com');

    fireEvent.change(accesos.getByLabelText('Contraseña nueva'), { target: { value: 'corta' } });
    fireEvent.click(accesos.getByRole('button', { name: /Guardar usuario/ }));
    expect(accesos.getByRole('alert')).toHaveTextContent('al menos 6 caracteres');

    expect(fake.state.invocations).toEqual([]);
  });
});

describe('errores al guardar en Configuración y Plataformas', () => {
  it('si no se pueden guardar los datos de cobro avisa y conserva lo cargado', async () => {
    await renderApp();
    goTo('Configuración');
    fake.failures['user_configs.update'] = { message: 'sin conexión' };

    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'mi.alias' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudieron guardar los datos de cobro'));
    expect(h.toast.success).not.toHaveBeenCalledWith('Datos de cobro guardados');
    expect(screen.getByLabelText('Alias')).toHaveValue('mi.alias');
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar datos de cobro/ })).toBeEnabled());
  });

  it('si no se puede guardar el catálogo avisa y no toca a los clientes', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Plataformas');
    fake.failures['user_configs.update'] = { message: 'sin conexión' };

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Netflix' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar Netflix' }));
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '12000' } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudieron guardar los precios'));
    expect(await screen.findByText('sin conexión')).toBeInTheDocument();
    expect(fake.tables.clients.filter(c => c.user_id === 'u1' && c.plan === 'Netflix').map(c => c.total)).toEqual([1000, 9000]);
  });

  it('si el servidor rechaza el cambio de usuario muestra el motivo', async () => {
    await renderApp();
    goTo('Configuración');
    const accesos = within(await screen.findByRole('region', { name: 'Accesos' }));
    await accesos.findByText('test@test.com');
    fake.failures['functions.manage-user'] = { message: 'Ese mail ya está en uso' };

    fireEvent.change(accesos.getByLabelText('Mail'), { target: { value: 'otro@test.com' } });
    fireEvent.click(accesos.getByRole('button', { name: /Guardar usuario/ }));

    expect(await accesos.findByRole('alert')).toHaveTextContent('Ese mail ya está en uso');
    expect(h.toast.success).not.toHaveBeenCalledWith('Usuario actualizado');
    expect(accesos.getByRole('button', { name: /Guardar usuario/ })).toBeEnabled();
  });

  it('guardar el usuario sin cambios no envía nada', async () => {
    await renderApp();
    goTo('Configuración');
    const accesos = within(await screen.findByRole('region', { name: 'Accesos' }));
    await accesos.findByText('test@test.com');

    fireEvent.click(accesos.getByRole('button', { name: /Guardar usuario/ }));
    expect(accesos.getByRole('alert')).toHaveTextContent('No hay cambios para guardar.');
    expect(fake.state.invocations).toEqual([]);
  });
});

describe('cambios sin guardar', () => {
  const aviso = () => screen.queryByRole('alertdialog', { name: 'Tenés cambios sin guardar' });
  const answer = (name: 'Seguir editando' | 'Salir sin guardar') => fireEvent.click(within(aviso()!).getByRole('button', { name }));

  it('al cambiar de sección con datos de cobro sin guardar pregunta, y se puede seguir editando', async () => {
    await renderApp();
    goTo('Configuración');
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'sin.guardar' } });

    goTo('Clientes');
    expect(aviso()).toBeInTheDocument();
    answer('Seguir editando');
    expect(aviso()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configuración de Sistema' })).toBeInTheDocument();
    expect(screen.getByLabelText('Alias')).toHaveValue('sin.guardar');

    goTo('Clientes');
    answer('Salir sin guardar');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Configuración de Sistema' })).not.toBeInTheDocument());
    expect(fake.tables.user_configs ?? []).toEqual([]);
  });

  it('después de guardar se sale sin preguntar', async () => {
    await renderApp();
    goTo('Configuración');
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'guardado' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Datos de cobro guardados'));

    goTo('Clientes');
    expect(aviso()).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Configuración de Sistema' })).not.toBeInTheDocument());
  });

  it('sin cambios se navega y se cierran las ventanas directamente', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Configuración');
    goTo('Clientes');
    expect(aviso()).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Nuevo Cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aviso()).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByPlaceholderText('Ej: Juan Pérez')).not.toBeInTheDocument());
  });

  it('pregunta al cerrar el alta de un cliente con datos cargados', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo Cliente/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej: Juan Pérez'), { target: { value: 'Nueva Persona' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    answer('Seguir editando');
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Nueva Persona');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    answer('Salir sin guardar');
    await waitFor(() => expect(screen.queryByPlaceholderText('Ej: Juan Pérez')).not.toBeInTheDocument());
    expect(fake.tables.clients.some(c => c.nombre === 'Nueva Persona')).toBe(false);
  });

  it('pregunta al cerrar un pago modificado sin registrar', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Registrar pago de Vencido Tres' }))[0]);
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar pago' }));
    fireEvent.change(dialog.getByLabelText('Monto cobrado'), { target: { value: '2500' } });

    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));
    answer('Seguir editando');
    expect(dialog.getByLabelText('Monto cobrado')).toHaveValue(2500);
    fireEvent.click(dialog.getByRole('button', { name: 'Cerrar' }));
    answer('Salir sin guardar');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar pago' })).not.toBeInTheDocument());
    expect(fake.tables.payments ?? []).toEqual([]);
  });

  it('pregunta al cerrar la ficha con una nota escrita sin guardar', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    fireEvent.click(rowOf('Al Día').getByRole('button', { name: 'Ver ficha de Al Día' }));
    const ficha = within(await screen.findByRole('dialog', { name: 'Ficha de Al Día' }));
    fireEvent.change(ficha.getByLabelText('Nueva nota'), { target: { value: 'Llamar el lunes' } });

    fireEvent.click(ficha.getByRole('button', { name: 'Cerrar ficha' }));
    answer('Seguir editando');
    expect(ficha.getByLabelText('Nueva nota')).toHaveValue('Llamar el lunes');
    fireEvent.click(ficha.getByRole('button', { name: 'Cerrar ficha' }));
    answer('Salir sin guardar');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ficha de Al Día' })).not.toBeInTheDocument());
  });

  it('en Plataformas pregunta por una edición sin guardar y por un aumento sin calcular', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Plataformas');

    fireEvent.click(await screen.findByRole('button', { name: 'Editar Netflix' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar Netflix' }));
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '5000' } });
    fireEvent.click(popup.getByRole('button', { name: 'Cancelar' }));
    answer('Salir sin guardar');
    expect(screen.queryByRole('dialog', { name: 'Editar Netflix' })).not.toBeInTheDocument();
    expect(fake.tables.user_configs ?? []).toEqual([]);

    fireEvent.change(screen.getByLabelText('Aumento general'), { target: { value: '10' } });
    goTo('Clientes');
    answer('Seguir editando');
    expect(screen.getByLabelText('Aumento general')).toHaveValue('10');
  });

  it('pregunta antes de cerrar sesión con cambios en Accesos, y acepta contraseñas de 6 caracteres', async () => {
    await renderApp();
    goTo('Configuración');
    const accesos = within(await screen.findByRole('region', { name: 'Accesos' }));
    await accesos.findByText('test@test.com');
    fireEvent.change(accesos.getByLabelText('Contraseña nueva'), { target: { value: '123456' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]);
    answer('Seguir editando');
    expect(fake.log).not.toContain('auth.signOut');
    expect(accesos.getByLabelText('Contraseña nueva')).toHaveValue('123456');

    fireEvent.click(accesos.getByRole('button', { name: /Guardar usuario/ }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Usuario actualizado'));
    expect(fake.state.invocations).toEqual([{ password: '123456' }]);
  });

  it('al recargar o cerrar la pestaña con cambios pide confirmación al navegador', async () => {
    await renderApp();
    goTo('Configuración');
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);

    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: 'pendiente' } });
    expect(unload()).toBe(true);
  });
});

describe('clientes: filtros, celular y errores', () => {
  async function openClients() {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    await screen.findByText('Al Día');
  }
  const names = () => screen.getAllByRole('row').slice(1).map(r => r.querySelector('td button[title="Ver ficha"]')?.textContent?.trim());

  /** Elige una opción de un Select de Radix (se abre con el teclado: jsdom no simula bien el puntero). */
  function choose(trigger: HTMLElement, option: string) {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(screen.getByRole('option', { name: option }));
  }

  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });

  it('filtra por plataforma y por estado, y ordena por menor monto', async () => {
    await openClients();
    const [plataforma, estado, orden] = screen.getAllByRole('combobox');

    choose(orden, 'Menor monto');
    expect(names()).toEqual(['Hoy Uno', 'Pronto Dos', 'Vencido Tres', 'Perdido Cuatro', 'Al Día']);

    choose(plataforma, 'Spotify');
    expect(names()).toEqual(['Vencido Tres', 'Perdido Cuatro']);

    choose(plataforma, 'Plataforma');
    choose(estado, 'Por vencer');
    expect(names()).toEqual(['Pronto Dos']);
  });

  it('busca combinando el texto con los filtros y avisa si no hay resultados', async () => {
    await openClients();
    const [plataforma] = screen.getAllByRole('combobox');
    choose(plataforma, 'Netflix');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre...'), { target: { value: 'vencido' } });
    expect(screen.getByText('No se encontraron clientes')).toBeInTheDocument();
  });

  it('si no se puede eliminar avisa y el cliente sigue en la lista', async () => {
    await openClients();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    fake.failures['clients.delete'] = { message: 'sin permiso' };

    fireEvent.click(rowOf('Hoy Uno').getByTitle('Eliminar'));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Error al eliminar cliente'));
    expect(screen.getByText('Hoy Uno')).toBeInTheDocument();
    expect(fake.tables.clients.some(c => c.id === 'hoy')).toBe(true);
  });

  it('la vista previa de WhatsApp se puede cerrar sin enviar', async () => {
    await openClients();
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: /WhatsApp/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));
    expect(screen.queryByText('Vista previa del mensaje')).not.toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });

  describe('en el celular', () => {
    const width = window.innerWidth;
    beforeEach(() => { window.innerWidth = 400; });
    afterEach(() => { window.innerWidth = width; });

    it('muestra tarjetas con WhatsApp, cobro, edición, ficha y borrado', async () => {
      await openClients();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const card = within(screen.getByText('Vencido Tres').closest('article')!);
      expect(card.getByText('$3.000')).toBeInTheDocument();
      expect(card.getByText('-10 d')).toBeInTheDocument();

      fireEvent.click(card.getByRole('button', { name: /WhatsApp/ }));
      expect(screen.getByText('Vista previa del mensaje')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));

      fireEvent.click(card.getByRole('button', { name: /Registrar pago/ }));
      expect(screen.getByRole('dialog', { name: 'Registrar pago' })).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Registrar pago' })).getByRole('button', { name: 'Cancelar' }));

      fireEvent.click(card.getByTitle('Editar'));
      expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Vencido Tres');
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      fireEvent.click(card.getByRole('button', { name: 'Ver ficha de Vencido Tres' }));
      expect(await screen.findByRole('dialog', { name: 'Ficha de Vencido Tres' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' }));

      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      fireEvent.click(card.getByTitle('Eliminar'));
      await waitFor(() => expect(screen.queryByText('Vencido Tres')).not.toBeInTheDocument());
    });
  });
});

describe('mensajes: ficha, avisos de pago y errores', () => {
  async function openMessages() {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Mensajes');
    await screen.findByRole('tab', { name: /Recuperación/ });
  }

  it('el nombre del cliente en Mensajes abre su ficha', async () => {
    await openMessages();
    fireEvent.click(screen.getByRole('button', { name: 'Hoy Uno' }));
    expect(await screen.findByRole('dialog', { name: 'Ficha de Hoy Uno' })).toBeInTheDocument();
  });

  it('si no se puede registrar el envío avisa, pero el chat se abre igual', async () => {
    await openMessages();
    fake.failures['clients.update'] = { message: 'sin conexión' };
    fireEvent.click(await screen.findByRole('link', { name: /WhatsApp/ }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudo registrar el envío'));
  });

  it('después de cobrar desde Mensajes avisa por WhatsApp con la plantilla de pago y lo registra', async () => {
    await openMessages();
    openTab(/Vencidos/);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago de Vencido Tres' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar pago' }));
    fireEvent.click(dialog.getByRole('button', { name: /Confirmar pago/ }));

    fireEvent.click(await dialog.findByRole('button', { name: /Avisar por WhatsApp/ }));
    const url = new URL((window.open as any).mock.calls[0][0]);
    expect(url.host + url.pathname).toBe('wa.me/5492915371541');
    await waitFor(() => expect(fake.tables.client_events).toContainEqual(
      expect.objectContaining({ client_id: 'vencido', tipo: 'mensaje', detalle: 'Plantilla: Pago recibido' }),
    ));
    expect(screen.queryByRole('dialog', { name: 'Registrar pago' })).not.toBeInTheDocument();
  });
});

describe('dashboard: base vacía, importación y errores', () => {
  /** Arma un .xlsx real con una fila de título arriba, como la planilla del cliente. */
  function excelFile(rows: (string | number)[][]) {
    const sheet = XLSX.utils.aoa_to_sheet([['Dia de hoy'], [], ['ID', 'Clientes', 'Plataformas', 'Total', 'Fecha vencimiento', 'Telefono'], ...rows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Hoja1');
    const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    return new File([data], 'CLIENTES 2026.xlsx');
  }

  it('con la base vacía, "Ir a centro de carga" lleva a Configuración y "Alta Manual" abre el alta', async () => {
    fake.tables.clients = [];
    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Alta Manual' }));
    expect(screen.getByRole('heading', { name: 'Nuevo Cliente' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ir a centro de carga' }));
    expect(screen.getByRole('heading', { name: 'Configuración de Sistema' })).toBeInTheDocument();
  });

  it('importa un Excel desde la base vacía y vuelve al dashboard con los clientes', async () => {
    fake.tables.clients = [];
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /Cargar Excel/ }));

    const zone = screen.getByText(/Arrastrá tu excel/).closest('div[class*="border-dashed"]')!;
    fireEvent.drop(zone, { dataTransfer: { files: [excelFile([
      [1, 'ANA PEREZ', 'NET', 10000, dayOffset(0), 2915371541],
      [2, 'BETO GOMEZ', 'SUFF', 8000, dayOffset(10), ''],
      [3, '', '', '', '', ''],
    ])] } });

    fireEvent.click(await screen.findByRole('button', { name: /Revisar 3 registros/ }));
    expect(await screen.findByTestId('import-nuevos')).toHaveTextContent('2');
    expect(screen.getByTestId('import-avisos')).toHaveTextContent('1 sin teléfono');
    fireEvent.click(screen.getByRole('button', { name: /Confirmar importación/ }));

    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Clientes importados correctamente'));
    expect(await screen.findByRole('heading', { name: 'Panel de Control' })).toBeInTheDocument();
    expect(await screen.findByText('Gestionando 2 clientes en el sistema.')).toBeInTheDocument();
    // Las plataformas se traducen de los códigos de la planilla
    expect(fake.tables.clients.find(c => c.nombre === 'ANA PEREZ')).toMatchObject({ celular: '5492915371541', total: 10000, plan: 'Netflix' });
    expect(fake.tables.clients.find(c => c.nombre === 'BETO GOMEZ')).toMatchObject({ plan: 'SUFF' });
  });

  it('si no se puede deshacer un pago avisa y el pago queda', async () => {
    fake.tables.payments = [{
      id: 'p1', user_id: 'u1', client_id: 'aldia', cliente_nombre: 'Al Día', plan: 'Netflix', monto: 9000, medio: 'Efectivo',
      fecha_pago: dayOffset(0), vencimiento_anterior: dayOffset(-11), vencimiento_nuevo: dayOffset(20),
    }];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    await renderApp();
    fake.failures['clients.update'] = { message: 'sin conexión' };

    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer pago de Al Día' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudo deshacer el pago'));
    expect(fake.tables.payments).toHaveLength(1);
    expect(screen.getByTestId('cobrado-mes')).toHaveTextContent('$9.000');
  });

  it('avisa si no puede cargar los permisos del usuario', async () => {
    fake.failures['rpc.current_workspace'] = { message: 'sin conexión' };
    render(<Index />);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('No se pudo cargar tu acceso'));
  });
});

describe('revisión lógica: pagos, bajas y plataformas', () => {
  it('si deshacer no puede volver atrás el vencimiento, lo avisa', async () => {
    fake.tables.payments = [{
      id: 'p1', user_id: 'u1', client_id: 'aldia', cliente_nombre: 'Al Día', plan: 'Netflix', monto: 9000, medio: 'Efectivo',
      // Este pago dejó un vencimiento que después cambió (hubo otra renovación)
      fecha_pago: dayOffset(0), vencimiento_anterior: dayOffset(-11), vencimiento_nuevo: dayOffset(5),
    }];
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    await renderApp();

    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer pago de Al Día' }));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalledWith(expect.stringMatching(/el vencimiento de Al Día no se tocó/)));
    expect(h.toast.success).not.toHaveBeenCalledWith('Pago deshecho');
    expect(fake.tables.payments).toEqual([]);
    expect(fake.tables.clients.find(c => c.id === 'aldia')!.vencimiento).toBe(dayOffset(20));
  });

  it('dar de baja saca al cliente de Mensajes y del dashboard, y se puede reactivar', async () => {
    await renderApp();
    await screen.findByText('Hoy Uno');
    goTo('Clientes');
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: 'Ver ficha de Vencido Tres' }));
    const ficha = within(await screen.findByRole('dialog', { name: 'Ficha de Vencido Tres' }));

    fireEvent.click(ficha.getByRole('button', { name: /Dar de baja/ }));
    await waitFor(() => expect(fake.tables.clients.find(c => c.id === 'vencido')!.seguimiento).toBe('baja'));
    expect(h.toast.success).toHaveBeenCalledWith('Vencido Tres quedó dado de baja');
    expect(await ficha.findByText(/no aparece en Mensajes/)).toBeInTheDocument();
    await waitFor(() => expect(fake.tables.client_events).toContainEqual(expect.objectContaining({ client_id: 'vencido', tipo: 'estado', detalle: 'Dado de baja' })));

    fireEvent.click(ficha.getByRole('button', { name: 'Cerrar ficha' }));
    goTo('Mensajes');
    expect(await screen.findByRole('tab', { name: /Vencidos/ })).toHaveTextContent('0');

    goTo('Clientes');
    fireEvent.click(rowOf('Vencido Tres').getByRole('button', { name: 'Ver ficha de Vencido Tres' }));
    const ficha2 = within(await screen.findByRole('dialog', { name: 'Ficha de Vencido Tres' }));
    fireEvent.click(ficha2.getByRole('button', { name: /Reactivar cliente/ }));
    await waitFor(() => expect(fake.tables.clients.find(c => c.id === 'vencido')!.seguimiento).toBeNull());
  });
});
