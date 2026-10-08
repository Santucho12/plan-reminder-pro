import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { format } from 'date-fns';
import { dayOffset, makeClient } from '@/test/fakeSupabase';
import { DEFAULT_TEMPLATES } from '@/lib/whatsapp';

const h = vi.hoisted(() => ({ events: [] as any[], addClientEvent: null as any }));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
// La ficha lee y guarda su historial: se reemplaza solo eso, el resto de la capa de datos es la real
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  fetchClientEvents: async () => h.events,
  addClientEvent: (...args: any[]) => h.addClientEvent(...args),
}));

import StatusBadge from '@/components/StatusBadge';
import SummaryCards from '@/components/SummaryCards';
import ClientTable from '@/components/ClientTable';
import ClientDialog from '@/components/ClientDialog';
import MessagePreview from '@/components/MessagePreview';
import MessagesView from '@/components/MessagesView';
import EditableMessage from '@/components/EditableMessage';
import AppSidebar from '@/components/AppSidebar';
import PaymentDialog from '@/components/PaymentDialog';
import SendQueue from '@/components/SendQueue';
import PlansView from '@/components/PlansView';
import ClientSheet from '@/components/ClientSheet';
import { computeRenewal } from '@/lib/api';
import type { Payment } from '@/types/client';

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

describe('StatusBadge', () => {
  it.each([
    ['Vence hoy', 'text-rose-600'],
    ['Por vencer', 'text-amber-600'],
    ['Activo', 'text-emerald-600'],
    ['Vencido', 'text-slate-500'],
  ])('muestra "%s" con su color', (status, className) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toHaveClass(className);
  });
});

describe('SummaryCards', () => {
  const valueOf = (title: string) => screen.getByText(title).parentElement!.querySelector('h3')!.textContent;
  const payment = (overrides: Partial<Payment>): Payment => ({
    id: 'p1', client_id: 'c1', cliente_nombre: 'Ana', plan: 'Netflix', monto: 1000, medio: 'Efectivo',
    fecha_pago: dayOffset(0), vencimiento_anterior: null, vencimiento_nuevo: null, ...overrides,
  });

  it('cuenta los clientes por situación y suma la cartera vigente', () => {
    render(
      <SummaryCards
        clients={[
          makeClient({ id: '1', dias: 0, total: 1000 }),
          makeClient({ id: '2', dias: 2, total: 2000 }),
          makeClient({ id: '3', dias: 3, total: 500 }),
          makeClient({ id: '4', dias: 15, total: 4000 }),
          makeClient({ id: '5', dias: -4, total: 9999 }),
          makeClient({ id: '6', dias: -60, total: 9999 }),
        ]}
      />
    );

    // Activos: todos los que tienen el plan vigente (incluye hoy y próximos)
    expect(valueOf('Activos')).toBe('4');
    expect(valueOf('Vencen hoy')).toBe('1');
    expect(valueOf('Por vencer')).toBe('2');
    // Vencidos: solo los de 1 a 30 días; el de 60 días figura aparte como recuperación
    expect(valueOf('Vencidos')).toBe('1');
    expect(screen.getByText('Hace 1 a 30 días · 1 en recuperación')).toBeInTheDocument();
    expect(screen.getByTestId('cartera-vigente')).toHaveTextContent('$7.500');
    // Por cobrar: el que vence hoy + el vencido hace 4 días (el de 60 días ya es recuperación)
    expect(screen.getByTestId('por-cobrar')).toHaveTextContent('$10.999');
  });

  it('muestra lo cobrado en el mes a partir de los pagos registrados, sin números inventados', () => {
    render(
      <SummaryCards
        clients={[makeClient({ id: '1', dias: -4, total: 3000 })]}
        payments={[payment({ id: 'a', monto: 6000 }), payment({ id: 'b', monto: 3000 }), payment({ id: 'viejo', monto: 99999, fecha_pago: '2020-01-15' })]}
      />
    );

    expect(screen.getByTestId('cobrado-mes')).toHaveTextContent('$9.000');
    expect(screen.getByText(/2 pagos registrados/)).toBeInTheDocument();
    // 9.000 cobrados sobre 9.000 + 3.000 por cobrar
    expect(screen.getByTestId('eficiencia')).toHaveTextContent('75%');
    expect(screen.queryByText(/12\.5%|92%|Rendimiento Alto/)).not.toBeInTheDocument();
  });

  it('funciona sin clientes ni pagos', () => {
    render(<SummaryCards clients={[]} />);
    expect(screen.getByTestId('cobrado-mes')).toHaveTextContent('$0');
    expect(screen.getByTestId('eficiencia')).toHaveTextContent('Sin datos');
    expect(screen.getByText(/Todavía no registraste pagos/)).toBeInTheDocument();
  });

  it('lista los últimos pagos y permite deshacerlos', () => {
    const onUndoPayment = vi.fn();
    const pago = payment({ cliente_nombre: 'Beto Pagador', monto: 4200 });
    render(<SummaryCards clients={[]} payments={[pago]} onUndoPayment={onUndoPayment} />);

    expect(screen.getByText('Beto Pagador')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer pago de Beto Pagador' }));
    expect(onUndoPayment).toHaveBeenCalledWith(pago);
  });
});

describe('ClientTable', () => {
  it('muestra un mensaje cuando no hay clientes', () => {
    render(<ClientTable clients={[]} />);
    expect(screen.getByText('No se encontraron clientes')).toBeInTheDocument();
  });

  it('muestra los datos de cada cliente', () => {
    render(<ClientTable clients={[makeClient({ nombre: 'Ana', celular: '5491100000000', plan: 'HBO', total: 15000, dias: 2, estado: 'Por vencer', vencimiento: new Date(2026, 2, 16) })]} />);
    const row = screen.getByText('Ana').closest('tr')!;

    expect(within(row).getByText('5491100000000')).toBeInTheDocument();
    expect(within(row).getByText('HBO')).toBeInTheDocument();
    expect(within(row).getByText('16 mar 26')).toBeInTheDocument();
    expect(within(row).getByText('$15.000')).toBeInTheDocument();
    expect(within(row).getByText('Por vencer')).toBeInTheDocument();
    expect(screen.getByText('1 Resultados')).toBeInTheDocument();
  });

  it('los botones de la fila avisan con el cliente correcto', () => {
    const onSendMessage = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn();
    const ana = makeClient({ id: 'a', nombre: 'Ana' });
    const beto = makeClient({ id: 'b', nombre: 'Beto' });
    render(<ClientTable clients={[ana, beto]} onSendMessage={onSendMessage} onEdit={onEdit} onDelete={onDelete} />);
    const row = within(screen.getByText('Beto').closest('tr')!);

    fireEvent.click(row.getByRole('button', { name: /WhatsApp/ }));
    fireEvent.click(row.getByTitle('Editar'));
    fireEvent.click(row.getByTitle('Eliminar'));

    expect(onSendMessage).toHaveBeenCalledWith(beto);
    expect(onEdit).toHaveBeenCalledWith(beto);
    expect(onDelete).toHaveBeenCalledWith('b');
  });

  it('el nombre abre la ficha y el botón de cobro registra un pago', () => {
    const onOpen = vi.fn(), onRegisterPayment = vi.fn();
    const ana = makeClient({ id: 'a', nombre: 'Ana', seguimiento: 'prometio_pago' });
    render(<ClientTable clients={[ana]} onOpen={onOpen} onRegisterPayment={onRegisterPayment} />);
    const row = within(screen.getByText('Ana').closest('tr')!);

    fireEvent.click(row.getByRole('button', { name: 'Ver ficha de Ana' }));
    fireEvent.click(row.getByRole('button', { name: /Registrar pago de / }));

    expect(onOpen).toHaveBeenCalledWith(ana);
    expect(onRegisterPayment).toHaveBeenCalledWith(ana);
    expect(row.getByText('Prometió pagar')).toBeInTheDocument();
  });
});

describe('ClientDialog', () => {
  const fill = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });

  it('crea un cliente con los datos cargados y se cierra', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined), onClose = vi.fn();
    const { container } = render(<ClientDialog client={null} onSave={onSave} onClose={onClose} />);

    expect(screen.getByText('Nuevo Cliente')).toBeInTheDocument();
    fill('Ej: Juan Pérez', 'Ana');
    fill('549...', '2915371541');
    fill('Ej: Netflix 4K', 'Netflix');
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-12-01' } });
    fill('0', '15000');
    fill('Notas sobre el precio...', 'Promo');
    fireEvent.click(screen.getByRole('button', { name: /Crear Cliente/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      nombre: 'Ana', celular: '2915371541', plan: 'Netflix', vencimiento: '2026-12-01', total: 15000, nota_plataforma: '', nota_precio: 'Promo',
    });
  });

  it('al editar precarga los datos del cliente y no envía el estado calculado', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({ nombre: 'Ana', plan: 'HBO', total: 900, vencimiento: new Date(2026, 2, 16), estado: 'Vence hoy', nota_plataforma: 'perfil 2' });
    const { container } = render(<ClientDialog client={client} onSave={onSave} onClose={() => {}} />);

    expect(screen.getByText('Editar Cliente')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Ana');
    expect(container.querySelector('input[type="date"]')).toHaveValue('2026-03-16');
    expect(screen.getByPlaceholderText('Notas sobre la plataforma...')).toHaveValue('perfil 2');

    fill('Ej: Juan Pérez', 'Ana María');
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ nombre: 'Ana María', vencimiento: '2026-03-16', total: 900 });
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('estado');
  });

  it('al elegir un plan del catálogo propone su precio', () => {
    render(<ClientDialog client={null} onSave={vi.fn()} onClose={() => {}} plans={[{ nombre: 'Netflix 4K', precio: 8500 }]} />);
    fill('Ej: Netflix 4K', 'netflix 4k');
    expect(screen.getByPlaceholderText('0')).toHaveValue(8500);
  });

  it('no permite importes negativos', () => {
    render(<ClientDialog client={null} onSave={vi.fn()} onClose={() => {}} />);
    fill('0', '-50');
    expect(screen.getByPlaceholderText('0')).toHaveValue(0);
  });

  it('si falla el guardado el formulario queda abierto con lo cargado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSave = vi.fn().mockRejectedValue(new Error('falló')), onClose = vi.fn();
    render(<ClientDialog client={makeClient({ nombre: 'Ana' })} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar Cambios/ })).not.toBeDisabled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Ej: Juan Pérez')).toHaveValue('Ana');
  });

  it('Cancelar cierra sin guardar', () => {
    const onSave = vi.fn(), onClose = vi.fn();
    render(<ClientDialog client={null} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('MessagePreview', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal('open', open);
  });

  it('muestra el destinatario y el mensaje que le corresponde', () => {
    render(<MessagePreview client={makeClient({ nombre: 'Ana', celular: '5492915371541', dias: -5 })} onClose={() => {}} />);
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText('5492915371541')).toBeInTheDocument();
    expect(screen.getByText(/Tú suscripción ya está vencida/)).toBeInTheDocument();
  });

  it('el botón abre WhatsApp con el número y el mensaje, y avisa que se envió', () => {
    const onSent = vi.fn();
    const client = makeClient({ celular: '2915371541', dias: 0, total: 15000 });
    render(<MessagePreview client={client} onClose={() => {}} onSent={onSent} />);

    fireEvent.click(screen.getByRole('button', { name: /Enviar por WhatsApp/ }));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.host + parsed.pathname).toBe('wa.me/5492915371541');
    expect(parsed.searchParams.get('text')).toContain('hoy vence tu suscripción');
    expect(parsed.searchParams.get('text')).toContain('15.000');
    expect(target).toBe('_blank');
    expect(onSent).toHaveBeenCalledWith(client);
  });

  it('usa la plantilla editada', () => {
    const templates = { ...DEFAULT_TEMPLATES, today: 'Che [Nombre], hoy vence [Plan]' };
    render(<MessagePreview client={makeClient({ nombre: 'Ana', plan: 'HBO', dias: 0 })} templates={templates} onClose={() => {}} />);
    expect(screen.getByText('Che Ana, hoy vence HBO')).toBeInTheDocument();
  });

  it('sin número no deja enviar', () => {
    const onSent = vi.fn();
    render(<MessagePreview client={makeClient({ celular: '' })} onClose={() => {}} onSent={onSent} />);
    const button = screen.getByRole('button', { name: /Cliente sin número/ });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(open).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
  });

  it('la X cierra el panel', () => {
    const onClose = vi.fn();
    render(<MessagePreview client={makeClient()} onClose={onClose} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('EditableMessage', () => {
  it('muestra el mensaje con un lápiz para editarlo', () => {
    render(<EditableMessage message="Hola [Nombre]" onSave={vi.fn()} />);
    expect(screen.getByText('[Nombre]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar mensaje' })).toBeVisible();
  });

  it('guarda el texto editado', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableMessage message="Hola" onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola [Nombre], debés [Total]' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(onSave).toHaveBeenCalledWith('Hola [Nombre], debés [Total]');
  });

  it('Cancelar descarta los cambios', () => {
    const onSave = vi.fn();
    render(<EditableMessage message="Original" onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Otro' } });
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    expect(screen.getByRole('textbox')).toHaveValue('Original');
  });

  it('no deja guardar un mensaje vacío', () => {
    const onSave = vi.fn();
    render(<EditableMessage message="Original" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();
  });

  it('Restablecer vuelve al texto original', () => {
    render(<EditableMessage message="Editado" defaultMessage="De fábrica" onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.click(screen.getByRole('button', { name: /Restablecer/ }));
    expect(screen.getByRole('textbox')).toHaveValue('De fábrica');
  });

  it('si falla el guardado sigue en edición con el borrador', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('falló'));
    render(<EditableMessage message="Original" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Guardar/ })).not.toBeDisabled());
    expect(screen.getByRole('textbox')).toHaveValue('Borrador');
  });
});

describe('MessagesView', () => {
  const clients = [
    makeClient({ id: 'hoy', nombre: 'Hoy Uno', dias: 0, total: 1000 }),
    makeClient({ id: 'p1', nombre: 'Pronto Uno', dias: 1 }),
    makeClient({ id: 'p3', nombre: 'Pronto Tres', dias: 3 }),
    makeClient({ id: 'v', nombre: 'Vencido Uno', dias: -10 }),
    makeClient({ id: 'r', nombre: 'Recuperar Uno', dias: -45 }),
    makeClient({ id: 'ok', nombre: 'Al Día', dias: 20, estado: 'Activo' }),
  ];

  it('muestra cuántos clientes hay en cada grupo', () => {
    render(<MessagesView clients={clients} />);
    expect(screen.getByRole('tab', { name: /Vencen hoy/ })).toHaveTextContent('1');
    // De 1 a 3 días sin avisar: Pronto Uno y Pronto Tres
    expect(screen.getByRole('tab', { name: /Próximos 3 días/ })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Vencidos/ })).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /Recuperación/ })).toHaveTextContent('1');
  });

  it('cada pestaña lista solo sus clientes con su plantilla', () => {
    render(<MessagesView clients={clients} />);
    expect(screen.getByText('Hoy Uno')).toBeInTheDocument();
    expect(screen.queryByText('Pronto Uno')).not.toBeInTheDocument();
    expect(screen.getByText(/hoy vence tu suscripción/)).toBeInTheDocument();

    openTab(/Próximos 3 días/);
    expect(screen.getByText('Pronto Tres')).toBeInTheDocument();
    expect(screen.getByText('Pronto Uno')).toBeInTheDocument();
    expect(screen.queryByText('Hoy Uno')).not.toBeInTheDocument();

    openTab(/Vencidos/);
    expect(screen.getByText('Vencido Uno')).toBeInTheDocument();
    expect(screen.getByText(/ya está vencida/)).toBeInTheDocument();

    openTab(/Recuperación/);
    expect(screen.getByText('Recuperar Uno')).toBeInTheDocument();
    expect(screen.getByText(/10% de descuento/)).toBeInTheDocument();
  });

  it('los clientes al día no aparecen en ningún grupo', () => {
    render(<MessagesView clients={clients} />);
    for (const tab of [/Vencen hoy/, /Próximos 3 días/, /Vencidos/, /Recuperación/]) {
      openTab(tab);
      expect(screen.queryByText('Al Día')).not.toBeInTheDocument();
    }
  });

  it('muestra cuándo fue el último aviso para no repetirlo', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const haceCinco = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    render(<MessagesView clients={[
      makeClient({ id: 'a', nombre: 'Avisado Ayer', dias: -3, ultimoMensaje: ayer }),
      makeClient({ id: 'b', nombre: 'Avisado Hace Cinco', dias: -10, ultimoMensaje: haceCinco }),
      makeClient({ id: 'c', nombre: 'Nunca Avisado', dias: -12 }),
    ]} />);
    openTab(/Vencidos/);
    expect(within(screen.getByText('Avisado Ayer').closest('li')!).getByText('Último aviso: ayer')).toBeInTheDocument();
    expect(within(screen.getByText('Avisado Hace Cinco').closest('li')!).getByText('Último aviso: hace 5 días')).toBeInTheDocument();
    expect(within(screen.getByText('Nunca Avisado').closest('li')!).queryByText(/Último aviso/)).not.toBeInTheDocument();
  });

  it('el botón de WhatsApp lleva al chat del cliente con el mensaje prearmado', () => {
    const onSent = vi.fn();
    render(<MessagesView clients={clients} onSent={onSent} />);
    const link = screen.getByRole('link', { name: /WhatsApp/ });
    const url = new URL(link.getAttribute('href')!);

    expect(url.host + url.pathname).toBe('wa.me/5492915371541');
    expect(url.searchParams.get('text')).toContain('hoy vence tu suscripción');
    expect(url.searchParams.get('text')).toContain('💰 1.000');
    expect(link).toHaveAttribute('target', '_blank');

    fireEvent.click(link);
    expect(onSent).toHaveBeenCalledWith(clients[0]);
  });

  it('el link usa la plantilla editada', () => {
    const templates = { ...DEFAULT_TEMPLATES, today: 'Hola [Nombre]!' };
    render(<MessagesView clients={clients} templates={templates} />);
    const url = new URL(screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!);
    expect(url.searchParams.get('text')).toBe('Hola Hoy Uno!');
  });

  it('en Envíos la plantilla es solo vista previa y se edita desde Plantillas', async () => {
    const onSaveTemplate = vi.fn().mockResolvedValue(undefined);
    render(<MessagesView clients={clients} onSaveTemplate={onSaveTemplate} />);

    openTab(/Vencidos/);
    expect(screen.queryByRole('button', { name: 'Editar mensaje' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Editar en Plantillas/ }));

    const plantilla = within(screen.getByRole('region', { name: 'Plantilla Vencido' }));
    fireEvent.click(plantilla.getByRole('button', { name: 'Editar mensaje' }));
    expect(screen.getByRole('textbox')).toHaveValue(DEFAULT_TEMPLATES.expired);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo texto de vencidos' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(onSaveTemplate).toHaveBeenCalledWith('expired', 'Nuevo texto de vencidos'));
  });

  it('un cliente sin número no tiene link', () => {
    render(<MessagesView clients={[makeClient({ dias: 0, celular: '' })]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sin número').length).toBeGreaterThan(0);
  });

  it('marca "Enviado hoy" solo si el último mensaje fue hoy', () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    render(
      <MessagesView
        clients={[
          makeClient({ id: 'a', nombre: 'Ya Avisado', dias: 0, ultimoMensaje: new Date() }),
          makeClient({ id: 'b', nombre: 'Avisado Ayer', dias: 0, ultimoMensaje: yesterday }),
        ]}
      />
    );
    expect(within(screen.getByText('Ya Avisado').closest('li')!).getByText(/Enviado hoy/)).toBeInTheDocument();
    expect(within(screen.getByText('Avisado Ayer').closest('li')!).queryByText(/Enviado hoy/)).not.toBeInTheDocument();
  });

  it('avisa cuando un grupo está vacío', () => {
    render(<MessagesView clients={[]} />);
    expect(screen.getByText('No hay clientes en este grupo por ahora.')).toBeInTheDocument();
  });

  it('los clientes en "no molestar" o dados de baja no aparecen para contactar', () => {
    render(
      <MessagesView
        clients={[
          makeClient({ id: 'a', nombre: 'Normal', dias: 0 }),
          makeClient({ id: 'b', nombre: 'Sin Molestar', dias: 0, seguimiento: 'no_molestar' }),
          makeClient({ id: 'c', nombre: 'De Baja', dias: 0, seguimiento: 'baja' }),
          makeClient({ id: 'd', nombre: 'Prometió', dias: 0, seguimiento: 'prometio_pago' }),
        ]}
      />
    );
    expect(screen.getByRole('tab', { name: /Vencen hoy/ })).toHaveTextContent('2');
    expect(screen.queryByText('Sin Molestar')).not.toBeInTheDocument();
    expect(screen.queryByText('De Baja')).not.toBeInTheDocument();
  });

  it('puede ocultar a los que ya se les escribió hoy', () => {
    render(
      <MessagesView
        clients={[
          makeClient({ id: 'a', nombre: 'Ya Avisado', dias: 0, ultimoMensaje: new Date() }),
          makeClient({ id: 'b', nombre: 'Falta Avisar', dias: 0 }),
        ]}
      />
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Ocultar enviados hoy/ }));
    expect(screen.queryByText('Ya Avisado')).not.toBeInTheDocument();
    expect(screen.getByText('Falta Avisar')).toBeInTheDocument();
  });

  it('la cola recorre solo a los del grupo que todavía no recibieron mensaje hoy', () => {
    const onSent = vi.fn();
    render(
      <MessagesView
        onSent={onSent}
        clients={[
          makeClient({ id: 'a', nombre: 'Ya Avisado', dias: 0, ultimoMensaje: new Date() }),
          makeClient({ id: 'b', nombre: 'Falta Avisar', dias: 0 }),
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Enviar en cola \(1\)/ }));
    const queue = within(screen.getByRole('dialog', { name: 'Cola de envío' }));
    expect(queue.getByText('Falta Avisar')).toBeInTheDocument();
    expect(queue.getByText('Cliente 1 de 1')).toBeInTheDocument();
  });

  it('deshabilita la cola cuando ya se les escribió a todos hoy', () => {
    render(<MessagesView clients={[makeClient({ dias: 0, ultimoMensaje: new Date() })]} />);
    expect(screen.getByRole('button', { name: /Enviar en cola \(0\)/ })).toBeDisabled();
  });

  it('la sección Plantillas reúne todas las plantillas para editarlas', async () => {
    const onSaveTemplate = vi.fn().mockResolvedValue(undefined);
    render(<MessagesView clients={clients} onSaveTemplate={onSaveTemplate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Plantillas' }));

    for (const name of ['Vence hoy', 'Recordatorio', 'Vencido', 'Recuperación', 'Bienvenida', 'Pago recibido', 'Aumento de precio']) {
      expect(screen.getByRole('region', { name: `Plantilla ${name}` })).toBeInTheDocument();
    }
    const paid = within(screen.getByRole('region', { name: 'Plantilla Pago recibido' }));
    fireEvent.click(paid.getByRole('button', { name: 'Editar mensaje' }));
    fireEvent.change(paid.getByRole('textbox'), { target: { value: 'Gracias [Nombre]' } });
    fireEvent.click(paid.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(onSaveTemplate).toHaveBeenCalledWith('paid', 'Gracias [Nombre]'));
  });
});

describe('PaymentDialog', () => {
  it('propone el importe y un mes más de vencimiento, y confirma con lo cargado', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const client = makeClient({ nombre: 'Ana', dias: 5, total: 15000 });
    render(<PaymentDialog client={client} onConfirm={onConfirm} onClose={() => {}} />);

    expect(screen.getByLabelText('Monto cobrado')).toHaveValue(15000);
    expect(screen.getByLabelText('Nuevo vencimiento')).toHaveValue(computeRenewal(client.vencimiento, 1));

    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'Efectivo' } });
    // Renovar 3 meses cobra los 3 meses; el monto se puede corregir a mano
    fireEvent.change(screen.getByLabelText('Renueva por'), { target: { value: '3' } });
    expect(screen.getByLabelText('Monto cobrado')).toHaveValue(45000);
    fireEvent.change(screen.getByLabelText('Monto cobrado'), { target: { value: '42000' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ monto: 42000, medio: 'Efectivo', vencimientoNuevo: computeRenewal(client.vencimiento, 3) }));
    expect(await screen.findByText('Pago registrado')).toBeInTheDocument();
  });

  it('no deja registrar un pago de $0 ni un vencimiento que no avanza', () => {
    const onConfirm = vi.fn();
    const client = makeClient({ nombre: 'Ana', dias: 5, total: 15000 });
    render(<PaymentDialog client={client} onConfirm={onConfirm} onClose={() => {}} />);
    const confirmar = screen.getByRole('button', { name: /Confirmar pago/ });

    fireEvent.change(screen.getByLabelText('Monto cobrado'), { target: { value: '0' } });
    expect(screen.getByRole('alert')).toHaveTextContent('mayor a $0');
    expect(confirmar).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Monto cobrado'), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText('Nuevo vencimiento'), { target: { value: format(client.vencimiento, 'yyyy-MM-dd') } });
    expect(screen.getByRole('alert')).toHaveTextContent('posterior al actual');
    expect(confirmar).toBeDisabled();

    // Con el botón deshabilitado no se registra nada
    fireEvent.click(confirmar);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a un vencido no lo deja renovar a una fecha que ya pasó', () => {
    const client = makeClient({ nombre: 'Beto', dias: -20, total: 1000 });
    render(<PaymentDialog client={client} onConfirm={vi.fn()} onClose={() => {}} />);
    const ayer = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    fireEvent.change(screen.getByLabelText('Nuevo vencimiento'), { target: { value: ayer } });
    expect(screen.getByRole('alert')).toHaveTextContent('posterior a hoy');
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeDisabled();
  });

  it('después de cobrar ofrece avisar con la plantilla de pago recibido', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const onNotified = vi.fn(), onClose = vi.fn();
    const client = makeClient({ nombre: 'Ana', plan: 'HBO', dias: 0, total: 5000 });
    render(<PaymentDialog client={client} onConfirm={vi.fn().mockResolvedValue(undefined)} onClose={onClose} onNotified={onNotified} />);

    fireEvent.change(screen.getByLabelText('Nuevo vencimiento'), { target: { value: '2027-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Avisar por WhatsApp/ }));

    const text = new URL(open.mock.calls[0][0]).searchParams.get('text')!;
    expect(text).toContain('Recibimos tu pago de 💰 5.000');
    expect(text).toContain('hasta el 15/01/2027');
    expect(onNotified).toHaveBeenCalledWith(client);
    expect(onClose).toHaveBeenCalled();
  });

  it('si falla el registro el formulario queda abierto', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('falló'));
    render(<PaymentDialog client={makeClient()} onConfirm={onConfirm} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar pago/ })).not.toBeDisabled());
    expect(screen.queryByText('Pago registrado')).not.toBeInTheDocument();
  });
});

describe('SendQueue', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    open = vi.fn();
    vi.stubGlobal('open', open);
  });

  const clients = [
    makeClient({ id: 'a', nombre: 'Ana', celular: '5491100000001', dias: 0 }),
    makeClient({ id: 'x', nombre: 'Sin Numero', celular: '', dias: 0 }),
    makeClient({ id: 'b', nombre: 'Beto', celular: '5491100000002', dias: -5 }),
    makeClient({ id: 'c', nombre: 'Caro', celular: '5491100000003', dias: 0 }),
  ];

  it('recorre los clientes de a uno: enviar pasa al siguiente y saltar no envía', () => {
    const onSent = vi.fn();
    render(<SendQueue title="Cola" clients={clients} onSent={onSent} onClose={() => {}} />);

    expect(screen.getByText(/Cliente 1 de 3 · 1 sin número/)).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar y seguir/ }));
    expect(new URL(open.mock.calls[0][0]).pathname).toBe('/5491100000001');
    expect(onSent).toHaveBeenCalledWith(clients[0], undefined);

    // Cada cliente recibe la plantilla de su situación
    expect(screen.getByText('Beto')).toBeInTheDocument();
    expect(screen.getByText(/ya está vencida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Saltar/ }));
    expect(open).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Enviar y seguir/ }));
    expect(new URL(open.mock.calls[1][0]).pathname).toBe('/5491100000003');
    expect(screen.getByText('Abriste el chat de 2 de 3 clientes.')).toBeInTheDocument();
  });

  it('con una plantilla fija la usa para todos', () => {
    const onSent = vi.fn();
    render(<SendQueue title="Aumento" clients={[makeClient({ nombre: 'Ana', plan: 'HBO', total: 9000 })]} templateKey="increase" onSent={onSent} onClose={() => {}} />);
    expect(screen.getByText(/el valor de HBO pasa a ser de 💰 9.000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar y seguir/ }));
    expect(onSent.mock.calls[0][1]).toBe('increase');
  });

  it('avisa si nadie tiene un número usable', () => {
    render(<SendQueue title="Cola" clients={[clients[1]]} onClose={() => {}} />);
    expect(screen.getByText('No hay clientes para contactar')).toBeInTheDocument();
  });
});

describe('PlansView', () => {
  const clients = [
    makeClient({ id: 'n1', nombre: 'N1', plan: 'Netflix', total: 1000 }),
    makeClient({ id: 'n2', nombre: 'N2', plan: 'netflix ', total: 1000 }),
    makeClient({ id: 'n3', nombre: 'N3', plan: 'Netflix', total: 700, nota_precio: 'Precio amigo' }),
    makeClient({ id: 'h1', nombre: 'H1', plan: 'HBO', total: 500 }),
  ];

  const priceOf = (nombre: string) => screen.getByLabelText(`Precio de ${nombre}`);

  /** Abre el lápiz del plan y guarda con los cambios indicados. */
  function editPlan(nombre: string, changes: { nombre?: string; precio?: string }) {
    fireEvent.click(screen.getByRole('button', { name: `Editar ${nombre}` }));
    const popup = within(screen.getByRole('dialog', { name: `Editar ${nombre}` }));
    if (changes.nombre !== undefined) fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: changes.nombre } });
    if (changes.precio !== undefined) fireEvent.change(popup.getByLabelText('Precio'), { target: { value: changes.precio } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));
  }

  it('arma el catálogo con los planes de los clientes y su precio más común', () => {
    render(<PlansView clients={clients} plans={[]} onSave={vi.fn()} />);
    expect(priceOf('Netflix')).toHaveTextContent('$1.000');
    expect(priceOf('HBO')).toHaveTextContent('$500');
    expect(screen.getByText(/3 clientes/)).toBeInTheDocument();
    // El precio no se edita en la lista, solo con el lápiz
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('el precio guardado en el catálogo manda sobre el de los clientes', () => {
    render(<PlansView clients={clients} plans={[{ nombre: 'Netflix', precio: 1500 }]} onSave={vi.fn()} />);
    expect(priceOf('Netflix')).toHaveTextContent('$1.500');
    expect(screen.getByText(/2 con otro precio/)).toBeInTheDocument();
  });

  it('el aumento general se guarda solo y después se puede llevar a los clientes', async () => {
    const changed = [{ ...clients[0], total: 1100 }];
    const onSave = vi.fn().mockResolvedValue(changed), onNotify = vi.fn();
    render(<PlansView clients={clients} plans={[]} onSave={onSave} onNotify={onNotify} />);

    fireEvent.change(screen.getByLabelText('Aumento general'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));
    expect(priceOf('Netflix')).toHaveTextContent('$1.100');
    expect(priceOf('HBO')).toHaveTextContent('$550');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      [{ nombre: 'HBO', precio: 550 }, { nombre: 'Netflix', precio: 1100 }],
      { applyToClients: false, skipNoted: true, renames: [] },
    ));

    // N3 tiene nota de precio: no se cuenta
    fireEvent.click(screen.getByRole('button', { name: /Aplicar precios a 3 clientes/ }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(
      [{ nombre: 'HBO', precio: 550 }, { nombre: 'Netflix', precio: 1100 }],
      { applyToClients: true, skipNoted: true, renames: [] },
    ));

    fireEvent.click(await screen.findByRole('button', { name: /Avisar el aumento por WhatsApp/ }));
    expect(onNotify).toHaveBeenCalledWith(changed);
  });

  it('borrar una plataforma se guarda en el momento', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={[{ nombre: 'Netflix', precio: 1000 }, { nombre: 'HBO', precio: 500 }]} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar HBO del catálogo' }));
    expect(screen.queryByText('HBO')).not.toBeInTheDocument();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      [{ nombre: 'Netflix', precio: 1000 }],
      { applyToClients: false, skipNoted: true, renames: [] },
    ));
  });

  it('no deja borrar una plataforma que tiene clientes', () => {
    render(<PlansView clients={clients} plans={[]} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Quitar Netflix del catálogo' })).toBeDisabled();
  });

  it('el lápiz cambia nombre y precio, y renombra la plataforma en combos y clientes', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    const plans = [
      { nombre: 'HBO', precio: 500 },
      { nombre: 'Netflix', precio: 1000 },
      { nombre: 'Pack', precio: 1350, plataformas: ['Netflix', 'HBO'] },
    ];
    render(<PlansView clients={clients} plans={plans} onSave={onSave} />);

    editPlan('HBO', { nombre: 'HBO Max' });
    expect(screen.getByRole('button', { name: 'Editar HBO Max' })).toBeInTheDocument();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      [{ nombre: 'HBO Max', precio: 500 }, { nombre: 'Netflix', precio: 1000 }, { nombre: 'Pack', precio: 1350, plataformas: ['Netflix', 'HBO Max'] }],
      { applyToClients: false, skipNoted: true, renames: [{ from: 'HBO', to: 'HBO Max' }] },
    ));
  });

  it('editar con un nombre que ya existe muestra el error', () => {
    render(<PlansView clients={[]} plans={[{ nombre: 'Netflix', precio: 1000 }, { nombre: 'HBO', precio: 500 }]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar HBO' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar HBO' }));
    expect(popup.getByLabelText('Nombre')).toHaveValue('HBO');
    expect(popup.getByLabelText('Precio')).toHaveValue(500);
    fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: 'netflix' } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));
    expect(popup.getByRole('alert')).toHaveTextContent('Ya existe un plan o combo con ese nombre.');
  });

  it('arma un combo con dos plataformas y un precio propio', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={clients} plans={[]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuevo combo/ }));
    const popup = within(screen.getByRole('dialog', { name: 'Nuevo combo' }));

    fireEvent.click(popup.getByRole('button', { name: 'Netflix' }));
    fireEvent.click(popup.getByRole('button', { name: /Crear combo/ }));
    expect(popup.getByRole('alert')).toHaveTextContent('Elegí al menos dos plataformas.');

    fireEvent.click(popup.getByRole('button', { name: 'HBO' }));
    expect(popup.getByText('Por separado suman $1.500.')).toBeInTheDocument();
    // Propone la suma como precio
    expect(popup.getByLabelText('Precio')).toHaveValue(1500);
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '1200' } });
    fireEvent.click(popup.getByRole('button', { name: /Crear combo/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(priceOf('Netflix + HBO')).toHaveTextContent('$1.200');
    expect(screen.getByText(/20% de descuento/)).toBeInTheDocument();
    // Una plataforma que está en un combo no se puede borrar
    expect(screen.getByRole('button', { name: 'Quitar Netflix del catálogo' })).toBeDisabled();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([{ nombre: 'Netflix + HBO', precio: 1200, plataformas: ['Netflix', 'HBO'] }]),
      { applyToClients: false, skipNoted: true, renames: [] },
    ));
  });

  const withCombo = [
    { nombre: 'Netflix', precio: 1000 },
    { nombre: 'HBO', precio: 500 },
    { nombre: 'Pack', precio: 1200, plataformas: ['Netflix', 'HBO'] },
  ];

  it('al subir una plataforma pregunta si actualizar los combos y propone mantener el descuento', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={withCombo} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Aumento general'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));
    // El aumento general no toca el combo directamente
    expect(priceOf('Pack')).toHaveTextContent('$1.200');

    const dialog = within(screen.getByRole('dialog', { name: 'Actualizar combos' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(dialog.getByLabelText('Nuevo precio de Pack')).toHaveValue(1320);
    fireEvent.change(dialog.getByLabelText('Nuevo precio de Pack'), { target: { value: '1300' } });
    fireEvent.click(dialog.getByRole('button', { name: /Sí, actualizar combos/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      [{ nombre: 'HBO', precio: 550 }, { nombre: 'Netflix', precio: 1100 }, { nombre: 'Pack', precio: 1300, plataformas: ['Netflix', 'HBO'] }],
      { applyToClients: false, skipNoted: true, renames: [] },
    ));
  });

  it('se puede elegir no cambiar los combos', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={withCombo} onSave={onSave} />);

    editPlan('HBO', { precio: '800' });
    fireEvent.click(screen.getByRole('button', { name: /No, dejar los combos igual/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toContainEqual({ nombre: 'HBO', precio: 800 });
    expect(onSave.mock.calls[0][0]).toContainEqual({ nombre: 'Pack', precio: 1200, plataformas: ['Netflix', 'HBO'] });
  });

  it('si no cambió ninguna plataforma de un combo no pregunta', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={withCombo} onSave={onSave} />);
    editPlan('Pack', { precio: '1400' });

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toContainEqual({ nombre: 'Pack', precio: 1400, plataformas: ['Netflix', 'HBO'] });
    expect(screen.queryByRole('dialog', { name: 'Actualizar combos' })).not.toBeInTheDocument();
  });

  it('el precio del combo se aplica a los clientes que lo tienen', () => {
    render(<PlansView clients={[makeClient({ id: 'p', plan: 'Pack', total: 900 })]} plans={withCombo} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Aplicar precios a 1 cliente/ })).toBeEnabled();
  });

  it('agregar una plataforma nueva se guarda en el momento', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={[]} onSave={onSave} />);
    expect(screen.queryByRole('button', { name: /Guardar catálogo/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Nueva plataforma/ }));
    const popup = within(screen.getByRole('dialog', { name: 'Nueva plataforma' }));
    fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: 'Disney+' } });
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '3000' } });
    fireEvent.click(popup.getByRole('button', { name: /Agregar plataforma/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(priceOf('Disney+')).toHaveTextContent('$3.000');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ nombre: 'Disney+', precio: 3000 }], { applyToClients: false, skipNoted: true, renames: [] }));
  });

  it('al editar una plataforma un % recalcula el precio desde el actual', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={[{ nombre: 'YouTube Premium', precio: 3500 }]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar YouTube Premium' }));
    const popup = within(screen.getByRole('dialog', { name: 'Editar YouTube Premium' }));

    fireEvent.change(popup.getByLabelText('Ajuste'), { target: { value: '10' } });
    expect(popup.getByLabelText('Precio')).toHaveValue(3850);
    expect(popup.getByText(/Antes \$3\.500 → ahora \$3\.850 \(\+10%\)/)).toBeInTheDocument();
    fireEvent.change(popup.getByLabelText('Ajuste'), { target: { value: '-20' } });
    expect(popup.getByLabelText('Precio')).toHaveValue(2800);

    // Escribir el precio a mano borra el %
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '4000' } });
    expect(popup.getByLabelText('Ajuste')).toHaveValue('');
    fireEvent.change(popup.getByLabelText('Ajuste'), { target: { value: '10' } });
    fireEvent.click(popup.getByRole('button', { name: /Guardar cambios/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ nombre: 'YouTube Premium', precio: 3850 }], expect.anything()));
  });

  it('al crear un combo el % de descuento calcula el precio sobre la suma', async () => {
    const onSave = vi.fn().mockResolvedValue([]);
    render(<PlansView clients={[]} plans={[{ nombre: 'YouTube', precio: 3500 }, { nombre: 'Spotify', precio: 3000 }]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Nuevo combo/ }));
    const popup = within(screen.getByRole('dialog', { name: 'Nuevo combo' }));
    fireEvent.click(popup.getByRole('button', { name: 'YouTube' }));
    fireEvent.click(popup.getByRole('button', { name: 'Spotify' }));

    fireEvent.change(popup.getByLabelText('Descuento'), { target: { value: '10' } });
    expect(popup.getByLabelText('Precio')).toHaveValue(5850);
    expect(popup.getByText(/\$5\.850 en lugar de \$6\.500: 10% de descuento/)).toBeInTheDocument();
    fireEvent.click(popup.getByRole('button', { name: /Crear combo/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([{ nombre: 'YouTube + Spotify', precio: 5850, plataformas: ['YouTube', 'Spotify'] }]),
      expect.anything(),
    ));
  });

  it('una plataforma nueva no muestra el % (no tiene precio previo)', () => {
    render(<PlansView clients={[]} plans={[]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva plataforma/ }));
    expect(screen.queryByLabelText('Ajuste')).not.toBeInTheDocument();
  });

  it('pide nombre, precio válido y que no se repita, y se puede cancelar', () => {
    const onSave = vi.fn();
    render(<PlansView clients={[]} plans={[{ nombre: 'Netflix', precio: 1000 }]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Nueva plataforma/ }));
    const popup = within(screen.getByRole('dialog', { name: 'Nueva plataforma' }));
    const submit = () => fireEvent.click(popup.getByRole('button', { name: /Agregar plataforma/ }));

    submit();
    expect(popup.getByRole('alert')).toHaveTextContent('Escribí el nombre de la plataforma.');
    fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: ' netflix ' } });
    submit();
    expect(popup.getByRole('alert')).toHaveTextContent('Ya existe un plan o combo con ese nombre.');
    fireEvent.change(popup.getByLabelText('Nombre'), { target: { value: 'Disney+' } });
    submit();
    expect(popup.getByRole('alert')).toHaveTextContent('Ingresá un precio mayor a 0.');
    fireEvent.change(popup.getByLabelText('Precio'), { target: { value: '0' } });
    submit();
    expect(popup.getByRole('alert')).toHaveTextContent('Ingresá un precio mayor a 0.');

    fireEvent.click(popup.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Precio de Disney+')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('ClientSheet', () => {
  beforeEach(() => {
    h.events = [];
    h.addClientEvent = vi.fn(async (_userId: string, clientId: string, tipo: string, detalle: string) => ({
      id: 'nuevo', client_id: clientId, tipo, detalle, created_at: new Date().toISOString(),
    }));
  });

  const client = makeClient({ id: 'a', nombre: 'Ana', plan: 'HBO', total: 5000, dias: -5, estado: 'Vencido', nota_precio: 'Promo 2x1' });

  it('muestra los datos del cliente y su historial de pagos, mensajes y notas', async () => {
    h.events = [
      { id: 'e1', client_id: 'a', tipo: 'mensaje', detalle: 'Plantilla: Vencido', created_at: '2026-09-02T10:00:00Z' },
      { id: 'e2', client_id: 'a', tipo: 'nota', detalle: 'Dijo que paga el viernes', created_at: '2026-09-03T10:00:00Z' },
    ];
    const pago: Payment = { id: 'p1', client_id: 'a', cliente_nombre: 'Ana', plan: 'HBO', monto: 5000, medio: 'Efectivo', fecha_pago: '2026-08-01', vencimiento_anterior: '2026-08-01', vencimiento_nuevo: '2026-09-01' };
    render(<ClientSheet client={client} userId="u1" payments={[pago]} onClose={() => {}} />);

    const sheet = within(screen.getByRole('dialog', { name: 'Ficha de Ana' }));
    expect(sheet.getByText('Promo 2x1')).toBeInTheDocument();
    expect(await sheet.findByText('Dijo que paga el viernes')).toBeInTheDocument();
    expect(sheet.getByText('Plantilla: Vencido')).toBeInTheDocument();
    expect(sheet.getByText('Pago de $5.000')).toBeInTheDocument();
    expect(sheet.getByText(/renovado hasta el 01\/09\/2026/)).toBeInTheDocument();

    // Del más nuevo al más viejo
    const titles = sheet.getAllByRole('listitem').map(li => li.querySelector('p')!.textContent);
    expect(titles).toEqual(['Nota', 'Mensaje enviado', 'Pago de $5.000']);
  });

  it('agrega una nota al historial', async () => {
    render(<ClientSheet client={client} userId="u1" onClose={() => {}} />);
    expect(await screen.findByText(/Todavía no hay movimientos/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nueva nota'), { target: { value: ' Llamar el lunes ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Llamar el lunes')).toBeInTheDocument();
    expect(h.addClientEvent).toHaveBeenCalledWith('u1', 'a', 'nota', 'Llamar el lunes');
    expect(screen.getByLabelText('Nueva nota')).toHaveValue('');
  });

  it('si no puede guardar la nota lo avisa y conserva el texto', async () => {
    h.addClientEvent = vi.fn().mockRejectedValue(new Error('Falta actualizar la base'));
    render(<ClientSheet client={client} userId="u1" onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nueva nota'), { target: { value: 'Algo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Falta actualizar la base')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva nota')).toHaveValue('Algo');
  });

  it('envía la plantilla elegida y ya no ofrece cambiar el seguimiento', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const onSent = vi.fn();
    render(<ClientSheet client={client} userId="u1" onClose={() => {}} onSent={onSent} />);

    expect(screen.queryByLabelText('Seguimiento')).not.toBeInTheDocument();

    // Arranca con la plantilla que le corresponde por vencimiento
    expect(screen.getByLabelText('Enviar mensaje')).toHaveValue('expired');
    fireEvent.change(screen.getByLabelText('Enviar mensaje'), { target: { value: 'welcome' } });
    fireEvent.click(screen.getByRole('button', { name: /Abrir chat/ }));

    expect(new URL(open.mock.calls[0][0]).searchParams.get('text')).toContain('Ya quedó activo tu plan HBO');
    expect(onSent).toHaveBeenCalledWith(client, 'welcome');
  });

  it('desde la ficha se puede cobrar, editar y cerrar', () => {
    const onRegisterPayment = vi.fn(), onEdit = vi.fn(), onClose = vi.fn();
    render(<ClientSheet client={client} userId="u1" onClose={onClose} onRegisterPayment={onRegisterPayment} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole('button', { name: /Registrar pago/ }));
    fireEvent.click(screen.getByRole('button', { name: /Editar datos/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ficha' }));

    expect(onRegisterPayment).toHaveBeenCalledWith(client);
    expect(onEdit).toHaveBeenCalledWith(client);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AppSidebar', () => {
  it('navega entre las secciones', () => {
    const onViewChange = vi.fn();
    render(<AppSidebar activeView="dashboard" onViewChange={onViewChange} hasClients />);

    for (const [label, view] of [['Dashboard', 'dashboard'], ['Clientes', 'clientes'], ['Mensajes', 'mensajes'], ['Plataformas', 'plataformas'], ['Configuración', 'config']]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect(onViewChange).toHaveBeenLastCalledWith(view);
    }
  });

  it('ya no muestra el estado del bot de WhatsApp', () => {
    render(<AppSidebar activeView="dashboard" onViewChange={() => {}} hasClients />);
    expect(screen.queryByText(/Desconectado|Conectado|Conectando/)).not.toBeInTheDocument();
  });

  it('ofrece cargar el Excel solo cuando no hay clientes', () => {
    const onViewChange = vi.fn();
    const { rerender } = render(<AppSidebar activeView="dashboard" onViewChange={onViewChange} hasClients={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Cargar Excel/ }));
    expect(onViewChange).toHaveBeenCalledWith('upload');

    rerender(<AppSidebar activeView="dashboard" onViewChange={onViewChange} hasClients />);
    expect(screen.queryByRole('button', { name: /Cargar Excel/ })).not.toBeInTheDocument();
  });

  it('permite cerrar sesión', () => {
    const onLogout = vi.fn();
    render(<AppSidebar activeView="dashboard" onViewChange={() => {}} hasClients onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    expect(onLogout).toHaveBeenCalled();
  });
});
