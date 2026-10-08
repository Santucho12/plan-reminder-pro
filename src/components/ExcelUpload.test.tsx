import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ parseExcelFile: null as any, previewImport: null as any, applyImport: null as any }));

vi.mock('@/lib/excel', () => ({ parseExcelFile: (...args: any[]) => h.parseExcelFile(...args) }));
vi.mock('@/lib/api', () => ({
  previewImport: (...args: any[]) => h.previewImport(...args),
  applyImport: (...args: any[]) => h.applyImport(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ExcelUpload from '@/components/ExcelUpload';
import ConfigView from '@/components/ConfigView';
import { UnsavedChangesProvider, useConfirmLeave } from '@/hooks/useUnsavedChanges';

const rows = [
  { Clientes: 'Ana', Telefono: '2915371541', Plataformas: 'Netflix', 'Fecha vencimiento': '16/03/2026', Total: '15000' },
  { Clientes: 'Beto', Telefono: '2915371542', Plataformas: 'HBO', 'Fecha vencimiento': '17/03/2026', Total: '100' },
];
const headers = Object.keys(rows[0]);
const plan = {
  nuevos: [{ nombre: 'Beto', celular: '5492915371542', plan: 'HBO', vencimiento: '2026-03-17', total: 100, dias: 0 }],
  modificados: [{ id: 'ana', nombre: 'Ana', updates: { total: 15000 }, cambios: ['Total: $12.000 → $15.000'] }],
  sinCambios: 0,
  ausentes: [{ id: 'viejo', nombre: 'Carla Vieja' }],
  sinTotal: [],
  sinCelular: 0,
};

const drop = (name = 'clientes.xlsx') => {
  const zone = screen.getByText(/Arrastrá tu excel/).closest('div[class*="border-dashed"]')!;
  fireEvent.drop(zone, { dataTransfer: { files: [new File(['x'], name)] } });
};

beforeEach(() => {
  h.parseExcelFile = vi.fn().mockResolvedValue({ headers, rows });
  h.previewImport = vi.fn().mockResolvedValue(plan);
  h.applyImport = vi.fn().mockResolvedValue({ creados: 1, actualizados: 1, eliminados: 0 });
});

describe('ExcelUpload', () => {
  it('rechaza archivos que no son Excel ni CSV', () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop('foto.png');
    expect(screen.getByText(/Formato no soportado/)).toBeInTheDocument();
    expect(h.parseExcelFile).not.toHaveBeenCalled();
  });

  it('avisa si el archivo está vacío', async () => {
    h.parseExcelFile.mockResolvedValue({ headers: [], rows: [] });
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    expect(await screen.findByText(/está vacío o no se pudo leer/)).toBeInTheDocument();
  });

  it('avisa si el archivo no se puede leer', async () => {
    h.parseExcelFile.mockRejectedValue(new Error('corrupto'));
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    expect(await screen.findByText(/Error al leer el archivo/)).toBeInTheDocument();
  });

  it('reconoce las columnas solo y muestra qué va a cambiar antes de tocar la base', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();

    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));

    expect(await screen.findByText('Revisá los cambios')).toBeInTheDocument();
    const [sentRows, mapping, userId] = h.previewImport.mock.calls[0];
    expect(sentRows).toEqual(rows);
    expect(mapping).toMatchObject({ nombre: 'Clientes', celular: 'Telefono', plan: 'Plataformas', vencimiento: 'Fecha vencimiento', total: 'Total' });
    expect(userId).toBe('u1');

    expect(screen.getByTestId('import-nuevos')).toHaveTextContent('1');
    expect(screen.getByTestId('import-modificados')).toHaveTextContent('1');
    expect(screen.getByTestId('import-ausentes')).toHaveTextContent('1');
    expect(screen.getByText('Total: $12.000 → $15.000')).toBeInTheDocument();
    expect(screen.getByText(/Carla Vieja/)).toBeInTheDocument();
    expect(h.applyImport).not.toHaveBeenCalled();
  });

  it('al confirmar aplica los cambios conservando a los que no vinieron en el archivo', async () => {
    const onImport = vi.fn();
    render(<ExcelUpload userId="u1" onImport={onImport} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar importación/ }));

    expect(await screen.findByText('¡Importación exitosa!')).toBeInTheDocument();
    expect(h.applyImport).toHaveBeenCalledWith(plan, 'u1', { removeMissing: false });
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('solo elimina a los ausentes si se marca la casilla', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Eliminar estos 1 clientes/ }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar importación/ }));

    await waitFor(() => expect(h.applyImport).toHaveBeenCalledWith(plan, 'u1', { removeMissing: true }));
  });

  it('no avanza si falta asignar una columna obligatoria', async () => {
    h.parseExcelFile.mockResolvedValue({ headers: ['Clientes', 'Total'], rows: [{ Clientes: 'Ana', Total: '1' }] });
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();

    fireEvent.click(await screen.findByRole('button', { name: /Revisar 1 registros/ }));

    expect(screen.getByText('Faltan campos obligatorios: celular, vencimiento')).toBeInTheDocument();
    expect(h.previewImport).not.toHaveBeenCalled();
  });

  it('si no se importan los teléfonos, la columna deja de ser obligatoria', async () => {
    h.parseExcelFile.mockResolvedValue({ headers: ['Clientes', 'Total'], rows: [{ Clientes: 'Ana', Total: '1' }] });
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /No importar los teléfonos/ }));
    drop();

    fireEvent.click(await screen.findByRole('button', { name: /Revisar 1 registros/ }));
    expect(screen.getByText('Faltan campos obligatorios: vencimiento')).toBeInTheDocument();
  });

  it('por defecto toma los teléfonos y las plataformas del Excel', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    expect(screen.getByRole('checkbox', { name: /No importar las plataformas/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /No importar los teléfonos/ })).not.toBeChecked();
    drop();

    // Se piden teléfono y plataformas, pero no las columnas que la app calcula sola
    expect(await screen.findByText('Teléfono *', { selector: 'label' })).toBeInTheDocument();
    expect(screen.getByText('Plataformas', { selector: 'label' })).toBeInTheDocument();
    expect(screen.queryByText('Estado', { selector: 'label' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dias', { selector: 'label' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Revisar 2 registros/ }));
    await waitFor(() => expect(h.previewImport).toHaveBeenCalled());
    expect(h.previewImport.mock.calls[0][3]).toEqual({ ignorePhone: false, ignorePlan: false });
  });

  it('avisa en la revisión de clientes sin total o sin teléfono', async () => {
    h.previewImport.mockResolvedValue({ ...plan, sinTotal: ['Ceferino'], sinCelular: 3 });
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));

    const avisos = await screen.findByTestId('import-avisos');
    expect(avisos).toHaveTextContent('Sin total (quedan en $0): Ceferino');
    expect(avisos).toHaveTextContent('3 sin teléfono');
  });

  it('marcando ambas casillas no se toman plataformas ni teléfonos', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /No importar los teléfonos/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /No importar las plataformas/ }));
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    await waitFor(() => expect(h.previewImport).toHaveBeenCalled());
    expect(h.previewImport.mock.calls[0][3]).toEqual({ ignorePhone: true, ignorePlan: true });
  });

  it('tildando "No importar las plataformas" no se toman del Excel', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /No importar las plataformas/ }));
    drop();

    await screen.findByText(/No se importan: plataformas\./);
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    await waitFor(() => expect(h.previewImport).toHaveBeenCalled());
    expect(h.previewImport.mock.calls[0][3]).toEqual({ ignorePhone: false, ignorePlan: true });
  });

  it('permite corregir la asignación de columnas a mano', async () => {
    h.parseExcelFile.mockResolvedValue({ headers: ['Clientes', 'Contacto', 'Vencimiento', 'Total'], rows: [{ Clientes: 'Ana', Contacto: '1', Vencimiento: 'x', Total: '1' }] });
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();

    const selects = await screen.findAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'Contacto' } });
    fireEvent.click(screen.getByRole('button', { name: /Revisar 1 registros/ }));

    await waitFor(() => expect(h.previewImport).toHaveBeenCalled());
    expect(h.previewImport.mock.calls[0][1].celular).toBe('Contacto');
  });

  it('muestra el error si la importación falla y deja reintentar', async () => {
    h.applyImport.mockRejectedValue(new Error('La base rechazó los datos'));
    const onImport = vi.fn();
    render(<ExcelUpload userId="u1" onImport={onImport} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar importación/ }));

    expect(await screen.findByText('La base rechazó los datos')).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirmar importación/ })).not.toBeDisabled();
  });

  it('un doble click no importa dos veces', async () => {
    let finish: (value: unknown) => void = () => {};
    h.applyImport.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));

    const button = await screen.findByRole('button', { name: /Confirmar importación/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(h.applyImport).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /Importando/ })).toBeDisabled();
    finish({ creados: 1, actualizados: 1, eliminados: 0 });
    expect(await screen.findByText('¡Importación exitosa!')).toBeInTheDocument();
  });

  it('Volver regresa a la carga del archivo', async () => {
    render(<ExcelUpload userId="u1" onImport={() => {}} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen.getByText(/Arrastrá tu excel/)).toBeInTheDocument();
  });
});

describe('ExcelUpload con cambios sin guardar', () => {
  /** Simula salir de la pantalla (ej: el menú lateral). */
  const LeaveButton = ({ onLeave }: { onLeave: () => void }) => {
    const confirmLeave = useConfirmLeave();
    return <button type="button" onClick={() => confirmLeave(onLeave)}>Salir de la pantalla</button>;
  };
  const renderWithLeave = (onLeave: () => void) => render(
    <UnsavedChangesProvider>
      <ExcelUpload userId="u1" onImport={() => {}} />
      <LeaveButton onLeave={onLeave} />
    </UnsavedChangesProvider>,
  );

  it('sin archivo cargado se sale directamente', () => {
    const onLeave = vi.fn();
    renderWithLeave(onLeave);
    fireEvent.click(screen.getByRole('button', { name: 'Salir de la pantalla' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('con una importación a medias pregunta antes de salir', async () => {
    const onLeave = vi.fn();
    renderWithLeave(onLeave);
    drop();
    await screen.findByRole('button', { name: /Revisar 2 registros/ });

    fireEvent.click(screen.getByRole('button', { name: 'Salir de la pantalla' }));
    expect(screen.getByRole('alertdialog', { name: 'Tenés cambios sin guardar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Revisar 2 registros/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salir de la pantalla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('después de confirmar la importación se sale sin preguntar', async () => {
    const onLeave = vi.fn();
    renderWithLeave(onLeave);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar importación/ }));
    await screen.findByText('¡Importación exitosa!');

    fireEvent.click(screen.getByRole('button', { name: 'Salir de la pantalla' }));
    expect(onLeave).toHaveBeenCalled();
  });
});

describe('ConfigView', () => {
  it('solo ofrece la carga de la base: sin WhatsApp ni Mercado Pago', () => {
    render(<ConfigView userId="u1" />);
    expect(screen.getByText('Base de Datos')).toBeInTheDocument();
    expect(screen.getByText(/Arrastrá tu excel/)).toBeInTheDocument();
    expect(screen.queryByText(/Mercado Pago/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/QR|Bot|WhatsApp Business/)).not.toBeInTheDocument();
  });

  it('permite editar y guardar los datos de cobro', async () => {
    const onSaveCobro = vi.fn().mockResolvedValue(undefined);
    render(<ConfigView userId="u1" cobro={{ alias: 'viejo.alias', cbu: '111' }} onSaveCobro={onSaveCobro} />);

    expect(screen.getByLabelText('Alias')).toHaveValue('viejo.alias');
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: ' nuevo.alias ' } });
    expect(screen.queryByLabelText(/Link de pago/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }));

    await waitFor(() => expect(onSaveCobro).toHaveBeenCalledWith({ alias: 'nuevo.alias', cbu: '111' }));
  });

  it('al importar avisa para refrescar los clientes', async () => {
    const onDataUpdate = vi.fn();
    render(<ConfigView userId="u1" onDataUpdate={onDataUpdate} />);
    drop();
    fireEvent.click(await screen.findByRole('button', { name: /Revisar 2 registros/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar importación/ }));
    await waitFor(() => expect(onDataUpdate).toHaveBeenCalledTimes(1));
  });
});
