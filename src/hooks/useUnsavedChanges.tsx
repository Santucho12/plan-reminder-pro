import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Cambios sin guardar: cada formulario avisa si tiene datos cargados que todavía no guardó. Antes de
 * salir (cambiar de sección, cerrar una ventana, cerrar sesión o recargar la página) se pregunta si
 * seguir editando o descartarlos.
 */
interface UnsavedChangesContextValue {
  setDirty: (id: string, dirty: boolean) => void;
  /** Ejecuta `action` si no hay cambios pendientes (o solo los de `id`, si se pasa); si los hay, pregunta antes. */
  confirmLeave: (action: () => void, id?: string) => void;
}

// Sin proveedor (componentes sueltos) no hay nada que proteger: se sale directo
const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  setDirty: () => {},
  confirmLeave: (action) => action(),
});

export const UnsavedChangesProvider = ({ children }: { children: React.ReactNode }) => {
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(() => new Set());
  const dirtyRef = useRef(dirtyIds);
  dirtyRef.current = dirtyIds;
  const [pending, setPending] = useState<(() => void) | null>(null);

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds(prev => {
      if (prev.has(id) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const confirmLeave = useCallback((action: () => void, id?: string) => {
    const dirty = id ? dirtyRef.current.has(id) : dirtyRef.current.size > 0;
    if (dirty) setPending(() => action);
    else action();
  }, []);

  // Recargar o cerrar la pestaña: el navegador muestra su propio aviso
  const hasDirty = dirtyIds.size > 0;
  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDirty]);

  const value = useMemo(() => ({ setDirty, confirmLeave }), [setDirty, confirmLeave]);

  const leave = () => {
    const action = pending;
    setPending(null);
    action?.();
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
            aria-describedby="unsaved-desc"
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border p-6 space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 id="unsaved-title" className="text-lg font-bold tracking-tight">Tenés cambios sin guardar</h2>
                <p id="unsaved-desc" className="text-sm text-muted-foreground mt-1">
                  Hiciste cambios y no tocaste el botón de guardar. Si salís ahora se pierden.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={leave}
                className="w-full sm:w-auto sm:flex-1 shrink-0 h-12 px-4 rounded-xl bg-secondary text-rose-700 font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-colors"
              >
                Salir sin guardar
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setPending(null)}
                className="w-full sm:w-auto sm:flex-1 shrink-0 h-12 px-4 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                Seguir editando
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
};

/** Navegación protegida: pregunta antes de salir si hay cambios sin guardar en cualquier formulario. */
export const useConfirmLeave = () => useContext(UnsavedChangesContext).confirmLeave;

/**
 * Registra si este formulario tiene cambios sin guardar. Devuelve `confirmDiscard`, que protege el
 * cierre del propio formulario (ej: la X de una ventana) mirando solo sus cambios.
 */
export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  const { setDirty, confirmLeave } = useContext(UnsavedChangesContext);

  useEffect(() => {
    setDirty(id, dirty);
  }, [id, dirty, setDirty]);
  useEffect(() => () => setDirty(id, false), [id, setDirty]);

  return useCallback((action: () => void) => confirmLeave(action, id), [confirmLeave, id]);
}
