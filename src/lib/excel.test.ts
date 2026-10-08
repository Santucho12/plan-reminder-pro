import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile } from '@/lib/excel';
import { parseAmount, parseExcelDate } from '@/lib/api';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

function workbookFile(sheets: Record<string, any[][]>, name = 'clientes.xlsx') {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), sheetName);
  }
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([data], name);
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('parseExcelFile', () => {
  it('lee encabezados y filas de una planilla simple', async () => {
    const file = workbookFile({
      Hoja1: [
        ['Clientes', 'Telefono', 'Plataformas', 'Vencimiento', 'Total'],
        ['Ana', '2915371541', 'Netflix', '16/03/2026', 15000],
        ['Beto', 5492915371541, 'Spotify', '01/04/2026', '2.500'],
      ],
    });
    const { headers, rows } = await parseExcelFile(file);

    expect(headers).toEqual(['Clientes', 'Telefono', 'Plataformas', 'Vencimiento', 'Total']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Clientes: 'Ana', Telefono: '2915371541', Plataformas: 'Netflix', Vencimiento: '16/03/2026', Total: '15000' });
    expect(rows[1].Telefono).toBe('5492915371541');
    expect(parseAmount(rows[1].Total)).toBe(2500);
  });

  it('las celdas con formato de fecha llegan como el mismo día', async () => {
    const file = workbookFile({
      Hoja1: [
        ['Clientes', 'Vencimiento', 'Total'],
        ['Ana', new Date(2026, 2, 16), 100],
        ['Beto', new Date(2026, 11, 31), 100],
        ['Caro', new Date(2027, 0, 1), 100],
      ],
    });
    const { rows } = await parseExcelFile(file);
    expect(rows.map(r => parseExcelDate(r.Vencimiento))).toEqual(['2026-03-16', '2026-12-31', '2027-01-01']);
  });

  it('encuentra la tabla aunque haya títulos arriba', async () => {
    const file = workbookFile({
      Hoja1: [
        ['LISTADO GENERAL'],
        [],
        ['Nombre', 'Celular', 'Plan', 'Vence', 'Monto'],
        ['Ana', '2915371541', 'Netflix', '16/03/2026', 100],
      ],
    });
    const { headers, rows } = await parseExcelFile(file);
    expect(headers).toEqual(['Nombre', 'Celular', 'Plan', 'Vence', 'Monto']);
    expect(rows).toHaveLength(1);
    expect(rows[0].Nombre).toBe('Ana');
  });

  it('usa la primera hoja que tenga una tabla de clientes', async () => {
    const file = workbookFile({
      Notas: [['cosas sueltas'], ['sin tabla']],
      Clientes: [['Cliente', 'Total'], ['Ana', 100]],
    });
    const { rows } = await parseExcelFile(file);
    expect(rows).toEqual([{ Cliente: 'Ana', Total: '100' }]);
  });

  it('devuelve vacío si no reconoce una tabla de clientes', async () => {
    const file = workbookFile({ Hoja1: [['a', 'b'], [1, 2]] });
    expect(await parseExcelFile(file)).toEqual({ headers: [], rows: [] });
  });

  it('devuelve vacío si hay encabezados pero ninguna fila', async () => {
    const file = workbookFile({ Hoja1: [['Clientes', 'Total']] });
    expect(await parseExcelFile(file)).toEqual({ headers: [], rows: [] });
  });

  it('lee archivos CSV', async () => {
    const csv = 'Clientes,Telefono,Vencimiento,Total\nAna,2915371541,16/03/2026,15000\n';
    const { headers, rows } = await parseExcelFile(new File([csv], 'clientes.csv'));
    expect(headers).toEqual(['Clientes', 'Telefono', 'Vencimiento', 'Total']);
    expect(rows[0].Clientes).toBe('Ana');
    expect(parseAmount(rows[0].Total)).toBe(15000);
  });
});
