import * as XLSX from 'xlsx';
import { Client, ColumnMapping } from '@/types/client';
import { differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false });
        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
        resolve({ headers, rows: jsonData });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function mapRowsToClients(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): Client[] {
  return rows.map((row, index) => {
    const vencimientoStr = row[mapping.vencimiento];
    let vencimiento: Date;

    // Try parsing common date formats
    const parsed = new Date(vencimientoStr);
    if (!isNaN(parsed.getTime())) {
      vencimiento = parsed;
    } else {
      // Try DD/MM/YYYY
      const parts = vencimientoStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        vencimiento = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      } else {
        vencimiento = new Date();
      }
    }

    const today = startOfDay(new Date());
    const diffDays = differenceInDays(startOfDay(vencimiento), today);

    let estado: Client['estado'] = 'pendiente';
    if (diffDays < 0) estado = 'vencido';
    else if (diffDays > 3) estado = 'pagado';

    return {
      id: `client-${index}-${Date.now()}`,
      nombre: row[mapping.nombre] || '',
      apellido: row[mapping.apellido] || '',
      celular: row[mapping.celular] || '',
      plan: row[mapping.plan] || '',
      vencimiento,
      total: parseFloat(row[mapping.total]?.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
      estado,
    };
  });
}

export function getClientStatus(vencimiento: Date): Client['estado'] {
  const today = startOfDay(new Date());
  const diffDays = differenceInDays(startOfDay(vencimiento), today);
  if (diffDays < 0) return 'vencido';
  if (diffDays <= 3) return 'pendiente';
  return 'pagado';
}
