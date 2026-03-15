import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel';
import { ColumnMapping } from '@/types/client';
import { insertClientsFromExcel } from '@/lib/api';

interface ExcelUploadProps {
  onImport: () => void;
  userId: string;
}

type Step = 'upload' | 'mapping' | 'success';

const ExcelUpload = ({ onImport, userId }: ExcelUploadProps) => {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    nombre: '', apellido: '', celular: '', plan: '', vencimiento: '', total: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Formato no soportado. Usá archivos .xlsx, .xls o .csv');
      return;
    }
    try {
      const result = await parseExcelFile(file);
      if (result.rows.length === 0) {
        setError('El archivo está vacío o no se pudo leer.');
        return;
      }
      setHeaders(result.headers);
      setRows(result.rows);

      // Auto-map common column names
      const autoMap: ColumnMapping = { nombre: '', apellido: '', celular: '', plan: '', vencimiento: '', total: '' };
      const lowerHeaders = result.headers.map(h => h.toLowerCase().trim());
      
      const mappings: Record<keyof ColumnMapping, string[]> = {
        nombre: ['nombre', 'name', 'first_name', 'primer nombre'],
        apellido: ['apellido', 'last_name', 'surname', 'segundo nombre'],
        celular: ['celular', 'telefono', 'teléfono', 'phone', 'cel', 'whatsapp', 'wpp'],
        plan: ['plan', 'suscripcion', 'suscripción', 'membership', 'tipo'],
        vencimiento: ['vencimiento', 'vence', 'expiry', 'expiration', 'fecha', 'fecha_vencimiento'],
        total: ['total', 'monto', 'amount', 'precio', 'price', 'valor'],
      };

      for (const [key, aliases] of Object.entries(mappings)) {
        const idx = lowerHeaders.findIndex(h => aliases.some(a => h.includes(a)));
        if (idx >= 0) autoMap[key as keyof ColumnMapping] = result.headers[idx];
      }

      setMapping(autoMap);
      setStep('mapping');
    } catch {
      setError('Error al leer el archivo. Verificá que sea un Excel válido.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleConfirm = async () => {
    const requiredFields: (keyof ColumnMapping)[] = ['nombre', 'celular', 'vencimiento', 'total'];
    const missing = requiredFields.filter(f => !mapping[f]);
    if (missing.length > 0) {
      setError(`Faltan campos obligatorios: ${missing.join(', ')}`);
      return;
    }
    try {
      const clients = await insertClientsFromExcel(rows, mapping, userId);
      setImportedCount(clients.length);
      onImport();
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Error al importar');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold tracking-tighter">Cargar Excel</h2>
              <p className="text-muted-foreground mt-1">
                Subí tu archivo con los datos de clientes
              </p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-lg p-16 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.xlsx,.xls,.csv';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Upload size={24} strokeWidth={1.5} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Arrastrá tu archivo o hacé click para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    .xlsx, .xls o .csv — Columnas: Nombre, Celular, Plan, Vencimiento, Total
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-md bg-status-overdue text-status-overdue-text text-sm flex items-center gap-2"
              >
                <AlertCircle size={16} strokeWidth={1.5} />
                {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 'mapping' && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold tracking-tighter">Mapear columnas</h2>
              <p className="text-muted-foreground mt-1">
                Seleccioná qué columna del Excel corresponde a cada campo
              </p>
            </div>

            <div className="bg-card rounded-lg shadow-card border border-border p-6 space-y-4">
              {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((field) => {
                const labels: Record<keyof ColumnMapping, string> = {
                  nombre: 'Nombre *',
                  apellido: 'Apellido',
                  celular: 'Celular *',
                  plan: 'Plan',
                  vencimiento: 'Fecha de vencimiento *',
                  total: 'Total *',
                };
                return (
                  <div key={field} className="flex items-center gap-4">
                    <label className="w-48 text-sm font-medium text-foreground shrink-0">
                      {labels[field]}
                    </label>
                    <select
                      value={mapping[field]}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="">— Sin asignar —</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                );
              })}

              {error && (
                <div className="p-3 rounded-md bg-status-overdue text-status-overdue-text text-sm flex items-center gap-2">
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-border">
                <button
                  onClick={() => { setStep('upload'); setError(''); }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Importar {rows.length} registros
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="mt-6 bg-card rounded-lg shadow-card border border-border p-4">
              <p className="text-xs text-muted-foreground mb-3">Vista previa (primeras 3 filas)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {headers.map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {headers.map(h => (
                          <td key={h} className="px-3 py-2 font-mono text-foreground">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-status-paid flex items-center justify-center mx-auto mb-6"
            >
              <Check size={36} strokeWidth={1.5} className="text-status-paid-text" />
            </motion.div>
            <h2 className="text-2xl font-semibold tracking-tighter">¡Importación exitosa!</h2>
            <p className="text-muted-foreground mt-2">
              Se importaron <span className="font-mono font-semibold text-foreground">{importedCount}</span> clientes.
              Los mensajes se programarán automáticamente.
            </p>
            <button
              onClick={() => setStep('upload')}
              className="mt-8 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Cargar otro archivo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExcelUpload;
