import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Check, AlertCircle, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel';
import { ColumnMapping } from '@/types/client';
import { ImportPlan, applyImport, previewImport } from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface ExcelUploadProps {
  onImport: () => void;
  userId: string;
  /** Oculta el título "Cargar Excel" cuando la tarjeta que lo contiene ya tiene uno. */
  hideTitle?: boolean;
}

const COLUMNAS = ['Nombre', 'Celular', 'Plan', 'Vencimiento', 'Total'];

type Step = 'upload' | 'mapping' | 'preview' | 'success';

const PREVIEW_LIMIT = 8;

const ExcelUpload = ({ onImport, userId, hideTitle }: ExcelUploadProps) => {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    nombre: '', celular: '', plan: '', vencimiento: '', total: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [removeMissing, setRemoveMissing] = useState(false);
  const [result, setResult] = useState({ creados: 0, actualizados: 0, eliminados: 0 });
  const [importing, setImporting] = useState(false);
  /** Las plataformas se toman traduciendo los códigos de la planilla (NET, MAX…); se pueden ignorar. */
  const [ignorePlan, setIgnorePlan] = useState(false);
  const [ignorePhone, setIgnorePhone] = useState(false);
  // Un archivo leído cuya importación todavía no se confirmó
  useUnsavedChanges(step === 'mapping' || step === 'preview');

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
      const autoMap: ColumnMapping = { nombre: '', celular: '', plan: '', vencimiento: '', total: '' };
      const lowerHeaders = result.headers.map(h => h.toLowerCase().trim());
      
      const mappings: Record<keyof ColumnMapping, string[]> = {
        nombre: ['clientes', 'cliente', 'nombre', 'name', 'first_name'],
        celular: ['telefono', 'teléfono', 'celular', 'phone', 'cel', 'whatsapp', 'wpp'],
        plan: ['plataformas', 'plataforma', 'plan', 'suscripcion', 'suscripción', 'membership', 'tipo'],
        vencimiento: ['fecha vencimiento', 'vencimiento', 'fecha', 'vence', 'expiry', 'expiration'],
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

  // Paso 1: comparar el archivo con los clientes guardados, sin modificar nada todavía
  const handleReview = async () => {
    const requiredFields: (keyof ColumnMapping)[] = ['nombre', 'celular', 'vencimiento', 'total'];
    const missing = requiredFields.filter(f => !mapping[f] && !(f === 'celular' && ignorePhone));
    if (missing.length > 0) {
      setError(`Faltan campos obligatorios: ${missing.join(', ')}`);
      return;
    }
    if (importing) return;
    setImporting(true);
    setError('');
    try {
      setPlan(await previewImport(rows, mapping, userId, { ignorePhone, ignorePlan }));
      setRemoveMissing(false);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Error al leer los clientes actuales');
    } finally {
      setImporting(false);
    }
  };

  // Paso 2: aplicar los cambios que el usuario ya revisó
  const handleConfirm = async () => {
    if (importing || !plan) return;
    setImporting(true);
    setError('');
    try {
      setResult(await applyImport(plan, userId, { removeMissing }));
      onImport();
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Error al importar');
    } finally {
      setImporting(false);
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
            {!hideTitle && (
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold tracking-tighter">Cargar Excel</h2>
                <p className="text-muted-foreground mt-1">
                  Subí tu archivo con los datos de clientes
                </p>
              </div>
            )}

            <div
              role="button"
              tabIndex={0}
              aria-label="Elegir archivo Excel"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`group border-2 border-dashed rounded-[1.75rem] px-6 py-10 md:py-14 text-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-white/60 dark:bg-slate-900/30 hover:border-primary/50 hover:bg-primary/[0.03]'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
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
              <div className="flex flex-col items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-colors ${
                  dragOver ? 'bg-primary text-white border-primary' : 'bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white'
                }`}>
                  <Upload size={26} strokeWidth={2} />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-foreground">
                    <span className="hidden md:inline">Arrastrá tu excel o hacé click para seleccionar</span>
                    {/* En el celular no se arrastran archivos */}
                    <span className="md:hidden">Tocá para elegir tu Excel</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Archivos .xlsx, .xls o .csv</p>
                </div>
                <span className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-primary/20">
                  <FileSpreadsheet size={14} /> Elegir archivo
                </span>
                <div className="flex flex-wrap justify-center items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Columnas</span>
                  {COLUMNAS.map(col => (
                    <span key={col} className="px-2 py-0.5 rounded-md bg-secondary text-[11px] font-semibold text-slate-600 dark:text-slate-300">{col}</span>
                  ))}
                </div>
              </div>
            </div>

            <fieldset className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <legend className="sr-only">Datos que no se importan</legend>
              {[
                { id: 'ignorar-plataformas', checked: ignorePlan, set: setIgnorePlan, title: 'No importar las plataformas', hint: 'Si la dejás destildada, los códigos (NET, MAX, NET 2…) se traducen solos y lo que viene escrito al lado queda como nota.' },
                { id: 'ignorar-telefonos', checked: ignorePhone, set: setIgnorePhone, title: 'No importar los teléfonos', hint: 'Los clientes nuevos quedan sin número y lo cargás a mano.' },
              ].map(opt => (
                <label
                  key={opt.id}
                  htmlFor={opt.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    opt.checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <input
                    id={opt.id}
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => opt.set(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-foreground">{opt.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Si tildás una opción, los clientes que ya existen conservan ese dato y los nuevos quedan sin él.
            </p>

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
              {(Object.keys(mapping) as (keyof ColumnMapping)[])
                .filter(field => !(field === 'celular' && ignorePhone) && !(field === 'plan' && ignorePlan))
                .map((field) => {
                const labels: Record<keyof ColumnMapping, string> = {
                   nombre: 'Clientes *',
                   celular: 'Teléfono *',
                   plan: 'Plataformas',
                   vencimiento: 'Fecha de vencimiento *',
                   total: 'Total *',
                 };
                return (
                  <div key={field} className="flex items-center gap-4">
                    <label className="w-28 sm:w-48 text-sm font-medium text-foreground shrink-0">
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

              {(ignorePhone || ignorePlan) && (
                <p className="text-xs text-muted-foreground">
                  No se importan: {[ignorePlan && 'plataformas', ignorePhone && 'teléfonos'].filter(Boolean).join(' ni ')}.
                </p>
              )}

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
                  onClick={handleReview}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Comparando...' : `Revisar ${rows.length} registros`}
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

           
          </motion.div>
        )}

        {step === 'preview' && plan && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold tracking-tighter">Revisá los cambios</h2>
              <p className="text-muted-foreground mt-1">
                Todavía no se modificó nada. Esto es lo que va a pasar al confirmar.
              </p>
            </div>

            <div className="bg-card rounded-lg shadow-card border border-border p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'nuevos', label: 'Nuevos', value: plan.nuevos.length, color: 'text-emerald-600' },
                  { id: 'modificados', label: 'Con cambios', value: plan.modificados.length, color: 'text-amber-600' },
                  { id: 'sin-cambios', label: 'Sin cambios', value: plan.sinCambios, color: 'text-slate-500' },
                  { id: 'ausentes', label: 'No están en el Excel', value: plan.ausentes.length, color: 'text-rose-600' },
                ].map(stat => (
                  <div key={stat.id} className="rounded-lg bg-secondary/40 p-3 text-center">
                    <p data-testid={`import-${stat.id}`} className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  </div>
                ))}
              </div>

              {plan.modificados.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clientes que se actualizan</p>
                  <ul className="text-sm divide-y divide-border border border-border rounded-lg">
                    {plan.modificados.slice(0, PREVIEW_LIMIT).map(change => (
                      <li key={change.id} className="px-3 py-2">
                        <p className="font-semibold">{change.nombre}</p>
                        {change.cambios.map(text => <p key={text} className="text-xs text-muted-foreground">{text}</p>)}
                      </li>
                    ))}
                  </ul>
                  {plan.modificados.length > PREVIEW_LIMIT && (
                    <p className="text-xs text-muted-foreground">y {plan.modificados.length - PREVIEW_LIMIT} más.</p>
                  )}
                </div>
              )}

              {plan.nuevos.length > 0 && (
                <p className="text-sm">
                  <span className="font-semibold">Se agregan:</span>{' '}
                  <span className="text-muted-foreground">
                    {plan.nuevos.slice(0, PREVIEW_LIMIT).map(n => n.nombre).join(', ')}
                    {plan.nuevos.length > PREVIEW_LIMIT && ` y ${plan.nuevos.length - PREVIEW_LIMIT} más`}
                  </span>
                </p>
              )}

              {(plan.sinTotal.length > 0 || plan.sinCelular > 0) && (
                <div data-testid="import-avisos" className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-sm text-amber-900">
                  {plan.sinTotal.length > 0 && (
                    <p>
                      <span className="font-semibold">Sin total (quedan en $0):</span>{' '}
                      {plan.sinTotal.slice(0, PREVIEW_LIMIT).join(', ')}
                      {plan.sinTotal.length > PREVIEW_LIMIT && ` y ${plan.sinTotal.length - PREVIEW_LIMIT} más`}
                    </p>
                  )}
                  {plan.sinCelular > 0 && (
                    <p>
                      <span className="font-semibold">{plan.sinCelular} sin teléfono:</span> no van a recibir mensajes hasta que les cargues el número.
                    </p>
                  )}
                </div>
              )}

              {plan.ausentes.length > 0 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
                  <p className="text-sm text-rose-900">
                    <span className="font-semibold">Están cargados pero no vienen en el archivo:</span>{' '}
                    {plan.ausentes.slice(0, PREVIEW_LIMIT).map(a => a.nombre).join(', ')}
                    {plan.ausentes.length > PREVIEW_LIMIT && ` y ${plan.ausentes.length - PREVIEW_LIMIT} más`}
                  </p>
                  <label className="flex items-start gap-2 text-sm font-medium text-rose-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={removeMissing}
                      onChange={(e) => setRemoveMissing(e.target.checked)}
                      className="mt-0.5 rounded border-rose-300"
                    />
                    Eliminar estos {plan.ausentes.length} clientes (si no lo marcás, se conservan)
                  </label>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-md bg-status-overdue text-status-overdue-text text-sm flex items-center gap-2">
                  <AlertCircle size={16} strokeWidth={1.5} />
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-border">
                <button
                  onClick={() => { setStep('mapping'); setError(''); }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importando...' : 'Confirmar importación'}
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
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
              <span className="font-mono font-semibold text-foreground">{result.creados}</span> nuevos ·{' '}
              <span className="font-mono font-semibold text-foreground">{result.actualizados}</span> actualizados
              {result.eliminados > 0 && <> · <span className="font-mono font-semibold text-foreground">{result.eliminados}</span> eliminados</>}
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
