import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ExcelUpload from './ExcelUpload';
import AccessSettings from './AccessSettings';
import { Database, Landmark, Save, ShieldCheck } from 'lucide-react';
import { CobroData } from '@/types/client';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface ConfigViewProps {
  userId: string;
  onDataUpdate?: () => void;
  /** Datos de cobro que usan las plantillas ([Alias] y [CBU]). */
  cobro?: CobroData;
  onSaveCobro?: (cobro: CobroData) => Promise<void>;
  /** Mail del usuario logueado (sección Accesos). */
  currentEmail?: string;
}

const inputClass = 'w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all';
const labelClass = 'text-[10px] font-black text-muted-foreground uppercase tracking-widest';

const ConfigView = ({ userId, onDataUpdate, cobro, onSaveCobro, currentEmail }: ConfigViewProps) => {
  const [draft, setDraft] = useState<CobroData>(cobro ?? { alias: '', cbu: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cobro) setDraft(cobro);
  }, [cobro]);

  useUnsavedChanges(!!cobro && (draft.alias.trim() !== cobro.alias.trim() || draft.cbu.trim() !== cobro.cbu.trim()));

  const handleSaveCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !onSaveCobro) return;
    setSaving(true);
    try {
      await onSaveCobro({ alias: draft.alias.trim(), cbu: draft.cbu.trim() });
    } catch {
      // El error lo informa quien guarda; queda lo cargado para reintentar
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10">
      {cobro && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 px-1">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Datos de cobro</h2>
          </div>

          <form onSubmit={handleSaveCobro} className="bg-card rounded-[2rem] border border-border/50 shadow-xl p-5 md:p-8 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Landmark className="text-primary" size={24} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estos datos se insertan en los mensajes donde la plantilla tenga las variables{' '}
                <code className="font-bold text-primary">[Alias]</code> y <code className="font-bold text-primary">[CBU]</code>.
                Si cambian, los actualizás una sola vez acá.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="cobro-alias" className={labelClass}>Alias</label>
                <input id="cobro-alias" value={draft.alias} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} className={inputClass} placeholder="mi.alias" />
              </div>
              <div className="space-y-2">
                <label htmlFor="cobro-cbu" className={labelClass}>CBU / CVU</label>
                <input id="cobro-cbu" inputMode="numeric" value={draft.cbu} onChange={(e) => setDraft({ ...draft, cbu: e.target.value })} className={`${inputClass} font-mono`} placeholder="22 dígitos" />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-12 px-6 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar datos de cobro'}
            </button>
          </form>
        </section>
      )}

      <AccessSettings currentEmail={currentEmail} />

      <section className="space-y-6">
        <div className="flex items-center gap-3 px-1">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Base de Datos</h2>
        </div>

        <div className="bg-card rounded-[2rem] border border-border/50 shadow-xl p-5 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Database className="text-primary" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Importar clientes desde Excel</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Actualizá toda tu base en segundos con tu planilla de clientes.
                </p>
              </div>
            </div>

            <ol className="flex flex-wrap gap-2" aria-label="Pasos de la importación">
              {['Subí el archivo', 'Revisá los cambios', 'Confirmá'].map((paso, i) => (
                <li key={paso} className="flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-xl bg-secondary/50 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 text-primary text-[11px] font-black flex items-center justify-center shadow-sm">{i + 1}</span>
                  {paso}
                </li>
              ))}
            </ol>
          </div>

          <ExcelUpload
            hideTitle
            onImport={() => {
              if (onDataUpdate) onDataUpdate();
              toast.success('¡Base de datos actualizada con éxito!');
            }}
            userId={userId}
          />

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-primary" />
            Tus clientes se actualizan sin perder notas, pagos ni historial. Antes de confirmar ves exactamente qué cambia.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ConfigView;
