import * as XLSX from 'xlsx';
import { Client, ColumnMapping } from '@/types/client';
import { differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        let jsonData: Record<string, string>[] = [];
        let sheetName = '';
        let headers: string[] = [];

        const keywords = ['nombre', 'cliente', 'plan', 'plataforma', 'vencimiento', 'vence', 'total', 'monto'];

        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          // Obtenemos todas las filas como arrays para buscar la cabecera
          const allRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, defval: '' });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(allRows.length, 10); i++) {
            const row = allRows[i].map(c => String(c).toLowerCase());
            const matchCount = keywords.filter(k => row.some(cell => cell.includes(k))).length;
            if (matchCount >= 2) { // Si encontramos al menos 2 palabras clave, es nuestra cabecera
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex !== -1) {
            // Re-parseamos desde esa fila con raw: true para preservar las fechas
            const dataWithHeaders = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { 
              range: headerRowIndex, 
              raw: true,
              defval: ''
            });

            if (dataWithHeaders.length > 0) {
              // Convertir valores a string, especialmente fechas a ISO
              jsonData = dataWithHeaders.map(row => {
                const cleanedRow: Record<string, string> = {};
                for (const key in row) {
                  if (row[key] instanceof Date) {
                    cleanedRow[key] = row[key].toISOString();
                  } else {
                    cleanedRow[key] = String(row[key]);
                  }
                }
                return cleanedRow;
              });
              headers = Object.keys(jsonData[0]);
              sheetName = name;
              break;
            }
          }
        }

        if (jsonData.length === 0) {
          console.error('No se pudo encontrar una tabla de datos válida en el archivo');
          resolve({ headers: [], rows: [] });
          return;
        }

        console.log(`Tabla detectada en hoja: "${sheetName}". ${jsonData.length} filas encontradas.`);
        resolve({ headers, rows: jsonData });
      } catch (err) {
        console.error('Error parseando Excel:', err);
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
  return 'pendiente';
}

import * as XLSXStyle from 'xlsx-js-style';

export function exportToExcel(clients: any[]) {
  // 1. Preparar los datos
  const data = clients.map(c => ({
    'Nombre': c.nombre,
    'Celular': c.celular,
    'Plan': c.plan,
    'Vencimiento': c.vencimiento instanceof Date 
      ? c.vencimiento.toLocaleDateString('es-AR') 
      : String(c.vencimiento),
    'Total': c.total,
    'Estado': c.estado,
    'Dias': c.dias
  }));

  // 2. Crear la hoja
  const worksheet = XLSXStyle.utils.json_to_sheet(data);

  // 3. Definir estilos
  const headerStyle = {
    fill: { fgColor: { rgb: "0F172A" } }, // Slate 900
    font: { color: { rgb: "FFFFFF" }, bold: true, sz: 12 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const cellStyle = {
    alignment: { horizontal: "center", vertical: "center" },
    font: { sz: 10 }
  };

  const statusStyles: Record<string, any> = {
    'Activo': { 
      fill: { fgColor: { rgb: "D1FAE5" } }, 
      font: { color: { rgb: "065F46" }, bold: true },
      alignment: { horizontal: "center" }
    },
    'Vencido': { 
      fill: { fgColor: { rgb: "FEE2E2" } }, 
      font: { color: { rgb: "991B1B" }, bold: true },
      alignment: { horizontal: "center" }
    },
    'Vence hoy': { 
      fill: { fgColor: { rgb: "FEF3C7" } }, 
      font: { color: { rgb: "92400E" }, bold: true },
      alignment: { horizontal: "center" }
    },
    'Por vencer': { 
      fill: { fgColor: { rgb: "FEF3C7" } }, 
      font: { color: { rgb: "92400E" }, bold: true },
      alignment: { horizontal: "center" }
    }
  };

  // 4. Aplicar estilos a las celdas
  const range = XLSXStyle.utils.decode_range(worksheet['!ref'] || 'A1');
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSXStyle.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellRef]) continue;

      if (R === 0) {
        // Cabecera
        worksheet[cellRef].s = headerStyle;
      } else {
        // Cuerpo
        worksheet[cellRef].s = cellStyle;
        
        // Estilo especial para la columna de Estado (C=5)
        if (C === 5) {
          const status = String(worksheet[cellRef].v);
          if (statusStyles[status]) {
            worksheet[cellRef].s = { ...cellStyle, ...statusStyles[status] };
          }
        }
      }
    }
  }

  // 5. Ajustar anchos de columna
  worksheet['!cols'] = [
    { wch: 30 }, // Nombre
    { wch: 15 }, // Celular
    { wch: 15 }, // Plan
    { wch: 15 }, // Vencimiento
    { wch: 10 }, // Total
    { wch: 15 }, // Estado
    { wch: 8 },  // Dias
  ];

  // 6. Configurar el libro y descargar
  const workbook = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(workbook, worksheet, 'Clientes');

  const fileName = `FiestaCobra_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSXStyle.writeFile(workbook, fileName);
}
