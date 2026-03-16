import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel';
import { ColumnMapping } from '@/types/client';
import { insertClientsFromExcel } from '@/lib/api';
import { cn } from '@/lib/utils';

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
    nombre: '', celular: '', plan: '', vencimiento: '', total: '', alertas: '', dias: '',
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

      const autoMap: ColumnMapping = { nombre: '', celular: '', plan: '', vencimiento: '', total: '', alertas: '', dias: '' };
      const lowerHeaders = result.headers.map(h => h.toLowerCase().trim());
      
      const mappings: Record<keyof ColumnMapping, string[]> = {
        nombre: ['clientes', 'cliente', 'nombre', 'name', 'first_name'],
        celular: ['telefono', 'teléfono', 'celular', 'phone', 'cel', 'whatsapp', 'wpp'],
        plan: ['plataformas', 'plataforma', 'plan', 'suscripcion', 'suscripción', 'membership', 'tipo'],
        vencimiento: ['fecha vencimiento', 'vencimiento', 'fecha', 'vence', 'expiry', 'expiration'],
        total: ['total', 'monto', 'amount', 'precio', 'price', 'valor'],
        alertas: ['alertas', 'alerta', 'aviso', 'estado'],
        dias: ['dias', 'días', 'frecuencia'],
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
    <div className="max-w-3xl mx-auto py-8">
      {/* Step Indicator */}
      <div className="flex justify-center gap-2 mb-12">
        {(['upload', 'mapping', 'success'] as Step[]).map((s, i) => (
          <div 
            key={s} 
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              step === s ? "w-12 bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "w-4 bg-white/10"
            )} 
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter text-white">Cargar Planilla</h2>
              <p className="text-muted-foreground font-medium">
                Subí tu Excel para sincronizar con la base de datos maestra.
              </p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={cn(
                "relative group overflow-hidden border-2 border-dashed rounded-[2rem] p-20 text-center transition-all duration-500 cursor-pointer",
                dragOver 
                  ? "border-primary bg-primary/5 scale-[1.02] shadow-[0_0_50px_-10px_rgba(16,185,129,0.2)]" 
                  : "border-white/10 glass hover:border-primary/50"
              )}
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
              <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                  <FileSpreadsheet size={32} className="text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold text-white">
                    Arrastrá tu archivo o hacé click
                  </p>
                  <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
                    Aceptamos formatos .xlsx, .xls o .csv. Asegurate que las columnas sean legibles.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 font-semibold justify-center"
              >
                <AlertCircle size={20} />
                {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {step === 'mapping' && (
          <motion.div
            key="mapping"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter text-white">Mapeo Inteligente</h2>
              <p className="text-muted-foreground font-medium">
                Asigná las columnas de tu archivo a los campos del sistema.
              </p>
            </div>

            <div className="glass-card rounded-[2rem] p-8 space-y-8 border-white/5 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(Object.keys(mapping) as (keyof ColumnMapping)[]).map((field) => {
                  const labels: Record<keyof ColumnMapping, string> = {
                     nombre: 'Nombre de Cliente',
                     celular: 'Número de WhatsApp',
                     plan: 'Plataforma / Plan',
                     vencimiento: 'Fecha de Corte',
                     total: 'Monto de Cobro',
                     alertas: 'Estado Actual',
                     dias: 'Días Restantes',
                   };
                  const isRequired = ['nombre', 'celular', 'vencimiento', 'total'].includes(field);
                  
                  return (
                    <div key={field} className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-1.5">
                        {labels[field]}
                        {isRequired && <span className="text-primary">*</span>}
                      </label>
                      <select
                        value={mapping[field]}
                        onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full glass border-white/10 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none appearance-none transition-all cursor-pointer hover:bg-white/[0.05]"
                      >
                        <option value="" className="bg-slate-900">— Ignorar —</option>
                        {headers.map(h => (
                          <option key={h} value={h} className="bg-slate-900">{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-3">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-8 border-t border-white/5">
                <button
                  onClick={() => { setStep('upload'); setError(''); }}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-white transition-all underline-offset-4 hover:underline"
                >
                  Cancelar y volver
                </button>
                <button
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  Importar {rows.length} Clientes
                  <ArrowRight size={18} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border-white/5">
              <div className="bg-white/5 px-6 py-3 border-b border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pre-visualización de Datos</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      {headers.map(h => (
                        <th key={h} className="text-left px-6 py-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.01] transition-colors">
                        {headers.map(h => (
                          <td key={h} className="px-6 py-4 text-xs font-mono text-white/50">{row[h]}</td>
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 glass-card rounded-[3rem] space-y-8"
          >
            <div className="relative inline-block">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
                className="w-32 h-32 rounded-[2.5rem] bg-emerald-500 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center mx-auto"
              >
                <Check size={64} strokeWidth={4} className="text-emerald-950" />
              </motion.div>
              <div className="absolute -inset-4 bg-emerald-500/20 blur-3xl -z-10 rounded-full animate-pulse" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-5xl font-black tracking-tighter text-white">¡Misión Cumplida!</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Se han sincronizado <span className="text-primary font-bold">{importedCount} perfiles</span> con éxito. El bot de cobranza ya tiene las nuevas directivas.
              </p>
            </div>

            <div className="pt-8">
              <button
                onClick={() => setStep('upload')}
                className="px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/10 hover:bg-white/5 text-white transition-all hover:scale-105 active:scale-95"
              >
                Cargar otra planilla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExcelUpload;
