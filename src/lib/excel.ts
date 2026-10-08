import * as XLSX from 'xlsx';
import { format } from 'date-fns';

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
                    // Fecha local del día (se suma medio día para absorber desfases de zona horaria de la lectura)
                    cleanedRow[key] = format(new Date(row[key].getTime() + 12 * 60 * 60 * 1000), 'yyyy-MM-dd');
                  } else {
                    cleanedRow[key] = String(row[key]);
                  }
                }
                return cleanedRow;
              });
              // Las columnas sin encabezado llegan como __EMPTY, __EMPTY_1...: no se ofrecen para asignar
              headers = Object.keys(jsonData[0]).filter(h => !h.startsWith('__EMPTY'));
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
