import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Percent, Plus, Trash2, Save, MessageCircle, Package, Check, Pencil } from 'lucide-react';
import { Client, Plan, isCombo } from '@/types/client';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface PlansViewProps {
  clients: Client[];
  plans: Plan[];
  /**
   * Guarda el catálogo. Si `applyToClients` es true también actualiza el importe de los clientes de cada plan.
   * `renames` son los planes a los que se les cambió el nombre: sus clientes pasan a tener el nombre nuevo.
   */
  onSave: (plans: Plan[], options: { applyToClients: boolean; skipNoted: boolean; renames?: PlanRename[] }) => Promise<Client[]>;
  /** Abre la cola de avisos de aumento para los clientes a los que se les cambió el precio. */
  onNotify?: (clients: Client[]) => void;
}

export interface PlanRename {
  from: string;
  to: string;
}

/** Combo afectado por un cambio de precio de sus plataformas, con el precio que se le propone. */
interface ComboUpdate {
  nombre: string;
  actual: number;
  sugerido: number;
  aplicar: boolean;
}

const key = (name: string) => name.trim().toLowerCase();
const money = (value: number) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const inputClass = 'h-11 rounded-xl bg-secondary/40 border-none px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30';
const labelClass = 'text-[10px] font-black text-muted-foreground uppercase tracking-widest';

/** Precio más repetido entre los clientes de un plan (para proponerlo cuando el plan todavía no está en el catálogo). */
function commonPrice(clients: Client[]): number {
  const counts = new Map<number, number>();
  for (const c of clients) counts.set(c.total, (counts.get(c.total) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** Suma de los precios de las plataformas de un combo según un catálogo. */
function sumOf(combo: Plan, catalog: Plan[]): number {
  return (combo.plataformas || []).reduce((acc, name) => acc + (catalog.find(p => key(p.nombre) === key(name))?.precio ?? 0), 0);
}

/**
 * Precio propuesto para un combo cuando cambian sus plataformas: se ajusta en la misma proporción
 * que la suma de sus plataformas, así conserva el mismo descuento.
 */
export function suggestComboPrice(combo: Plan, before: Plan[], after: Plan[]): number {
  const oldSum = sumOf(combo, before);
  const newSum = sumOf(combo, after);
  if (oldSum <= 0) return Math.max(Math.round(combo.precio + newSum - oldSum), 0);
  return Math.round(combo.precio * (newSum / oldSum));
}

const PlansView = ({ clients, plans, onSave, onNotify }: PlansViewProps) => {
  const byPlan = useMemo(() => {
    const map = new Map<string, Client[]>();
    for (const c of clients) {
      if (!c.plan?.trim()) continue;
      const list = map.get(key(c.plan));
      if (list) list.push(c); else map.set(key(c.plan), [c]);
    }
    return map;
  }, [clients]);

  // Catálogo guardado + planes que ya usan los clientes y todavía no se cargaron
  const initialRows = useMemo<Plan[]>(() => {
    const rows = plans.map(p => ({ ...p }));
    const known = new Set(rows.map(p => key(p.nombre)));
    for (const [planKey, list] of byPlan) {
      if (!known.has(planKey)) rows.push({ nombre: list[0].plan.trim(), precio: commonPrice(list) });
    }
    return rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [plans, byPlan]);

  const [rows, setRows] = useState<Plan[]>(initialRows);
  const [percent, setPercent] = useState('');
  /** Pop-up abierto para crear o editar una plataforma o un combo. */
  const [dialog, setDialog] = useState<'plan' | 'combo' | null>(null);
  /** Nombre del plan que se está editando (null = alta). */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  /** En los combos el precio propone la suma de las plataformas hasta que el usuario lo edita. */
  const [priceEdited, setPriceEdited] = useState(false);
  const [comboPlatforms, setComboPlatforms] = useState<string[]>([]);
  /**
   * Porcentaje del pop-up: en combos es el descuento sobre la suma de sus plataformas; al editar una
   * plataforma es el ajuste sobre su precio actual (positivo = aumento). Vacío = precio a mano.
   */
  const [draftPercent, setDraftPercent] = useState('');
  /** Precio que tenía la plataforma al abrir el pop-up (base del ajuste %). */
  const [basePrice, setBasePrice] = useState(0);
  const [draftError, setDraftError] = useState('');
  /** Valores con los que se abrió el pop-up, para saber si se cambió algo. */
  const [dialogStart, setDialogStart] = useState({ name: '', price: '', platforms: '' });
  const [skipNoted, setSkipNoted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [affected, setAffected] = useState<Client[] | null>(null);
  /** Pregunta pendiente: actualizar los combos antes de guardar el catálogo. */
  const [comboPrompt, setComboPrompt] = useState<{
    rows: Plan[];
    applyToClients: boolean;
    renames: PlanRename[];
    updates: ComboUpdate[];
  } | null>(null);

  const platforms = rows.filter(r => !isCombo(r));
  const combos = rows.filter(isCombo);
  const comboSum = sumOf({ nombre: '', precio: 0, plataformas: comboPlatforms }, platforms);
  const clientsOf = (row: Plan) => byPlan.get(key(row.nombre)) || [];

  const persist = async (finalRows: Plan[], applyToClients: boolean, renames: PlanRename[]) => {
    setSaving(true);
    setError('');
    setAffected(null);
    try {
      const changed = await onSave(finalRows.filter(r => r.nombre.trim() !== ''), { applyToClients, skipNoted, renames });
      if (applyToClients) setAffected(changed);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cada cambio del catálogo se guarda en el momento. Si cambió el precio de plataformas que forman
   * parte de combos, antes pregunta si ajustar esos combos.
   */
  const commit = (finalRows: Plan[], options: { applyToClients?: boolean; renames?: PlanRename[] } = {}) => {
    const applyToClients = options.applyToClients ?? false;
    const renames = options.renames ?? [];
    setRows(finalRows);

    // Precios guardados, con el nombre actual de cada plataforma (por si se renombró)
    const renamedTo = (nombre: string) => renames.find(r => key(r.from) === key(nombre))?.to ?? nombre;
    const before = initialRows.filter(r => !isCombo(r)).map(r => ({ ...r, nombre: renamedTo(r.nombre) }));
    const after = finalRows.filter(r => !isCombo(r));
    const updates: ComboUpdate[] = finalRows
      .filter(isCombo)
      .filter(combo => sumOf(combo, before) !== sumOf(combo, after))
      .map(combo => {
        const saved = initialRows.find(r => key(renamedTo(r.nombre)) === key(combo.nombre));
        // Si el combo es nuevo se parte del precio cargado; si no, del guardado
        const base = saved && isCombo(saved) ? { ...saved, plataformas: saved.plataformas!.map(renamedTo) } : combo;
        return { nombre: combo.nombre, actual: combo.precio, sugerido: suggestComboPrice(base, before, after), aplicar: true };
      })
      .filter(u => u.sugerido !== u.actual);

    if (updates.length > 0) {
      setComboPrompt({ rows: finalRows, applyToClients, renames, updates });
      return;
    }
    persist(finalRows, applyToClients, renames);
  };

  const resolvePrompt = (updateCombos: boolean) => {
    if (!comboPrompt) return;
    const finalRows = updateCombos
      ? comboPrompt.rows.map(r => {
          const u = comboPrompt.updates.find(x => x.aplicar && x.nombre === r.nombre);
          return u ? { ...r, precio: u.sugerido } : r;
        })
      : comboPrompt.rows;
    setRows(finalRows);
    setComboPrompt(null);
    persist(finalRows, comboPrompt.applyToClients, comboPrompt.renames);
  };

  const applyPercent = () => {
    const pct = parseFloat(percent.replace(',', '.'));
    if (!Number.isFinite(pct) || pct === 0 || saving) return;
    // Solo las plataformas: los combos se ajustan si el usuario lo confirma
    commit(rows.map(r => (isCombo(r) ? r : { ...r, precio: Math.round(r.precio * (1 + pct / 100)) })));
    setPercent('');
  };

  const removeRow = (row: Plan) => {
    if (saving) return;
    commit(rows.filter(r => r.nombre !== row.nombre));
  };

  const nameTaken = (nombre: string) =>
    rows.some(r => key(r.nombre) === key(nombre) && (editing === null || key(r.nombre) !== key(editing)));

  const openDialog = (kind: 'plan' | 'combo', row?: Plan) => {
    setDialog(kind);
    setEditing(row?.nombre ?? null);
    setDraftName(row?.nombre ?? '');
    setDraftPrice(row ? String(row.precio) : '');
    // Al editar un combo se respeta su precio actual en lugar de proponer la suma
    setPriceEdited(!!row);
    setComboPlatforms(row?.plataformas ?? []);
    setDraftPercent('');
    setBasePrice(row?.precio ?? 0);
    setDraftError('');
    setDialogStart({ name: row?.nombre ?? '', price: row ? String(row.precio) : '', platforms: (row?.plataformas ?? []).join('|') });
  };

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const comboNameFinal = draftName.trim() || comboPlatforms.join(' + ');
  const percentValue = parseFloat(draftPercent.replace(',', '.'));
  const hasPercent = draftPercent.trim() !== '' && Number.isFinite(percentValue);
  /** El campo % aparece en combos (descuento) y al editar una plataforma (ajuste). */
  const showPercent = dialog === 'combo' || editing !== null;
  /**
   * Precio que muestra el pop-up: calculado con el % si se cargó; si no, en combos la suma de las
   * plataformas mientras no se edite a mano.
   */
  const shownPrice =
    hasPercent && dialog === 'combo' ? String(Math.max(Math.round(comboSum * (1 - percentValue / 100)), 0))
    : hasPercent ? String(Math.max(Math.round(basePrice * (1 + percentValue / 100)), 0))
    : dialog === 'combo' && !priceEdited ? (comboSum > 0 ? String(comboSum) : '')
    : draftPrice;
  const shownPriceValue = parseFloat(shownPrice) || 0;
  const comboDiscount = comboSum > 0 && shownPriceValue > 0 ? Math.round((1 - shownPriceValue / comboSum) * 100) : null;

  const confirmCloseDialog = useUnsavedChanges(
    dialog !== null && (
      draftName !== dialogStart.name
      || comboPlatforms.join('|') !== dialogStart.platforms
      || (priceEdited && draftPrice !== dialogStart.price)
      || draftPercent.trim() !== ''
    ),
  );
  // Un % de aumento general escrito sin tocar "Calcular"
  useUnsavedChanges(percent.trim() !== '');

  const togglePlatform = (nombre: string) => {
    setComboPlatforms(prev => (prev.includes(nombre) ? prev.filter(p => p !== nombre) : [...prev, nombre]));
    setDraftError('');
  };

  const confirmDialog = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const isComboDialog = dialog === 'combo';
    const nombre = isComboDialog ? comboNameFinal : draftName.trim();
    const precio = parseFloat(shownPrice.replace(',', '.'));

    if (isComboDialog && comboPlatforms.length < 2) return setDraftError('Elegí al menos dos plataformas.');
    if (!nombre) return setDraftError('Escribí el nombre de la plataforma.');
    if (nameTaken(nombre)) return setDraftError('Ya existe un plan o combo con ese nombre.');
    if (!Number.isFinite(precio) || precio <= 0) return setDraftError('Ingresá un precio mayor a 0.');

    const updated: Plan = isComboDialog ? { nombre, precio, plataformas: comboPlatforms } : { nombre, precio };
    if (editing === null) {
      commit([...rows, updated]);
    } else {
      const renames = editing !== nombre ? [{ from: editing, to: nombre }] : [];
      commit(
        rows.map(r => {
          if (r.nombre === editing) return updated;
          // Los combos que incluyen la plataforma renombrada pasan a usar el nombre nuevo
          if (renames.length > 0 && !isComboDialog && r.plataformas?.some(p => key(p) === key(editing))) {
            return { ...r, plataformas: r.plataformas.map(p => (key(p) === key(editing) ? nombre : p)) };
          }
          return r;
        }),
        { renames },
      );
    }
    closeDialog();
  };

  const usedInCombos = (nombre: string) => combos.filter(c => c.plataformas!.some(p => key(p) === key(nombre)));

  /** Clientes del plan cuyo importe quedaría distinto al precio del catálogo. */
  const outdated = (row: Plan) =>
    clientsOf(row).filter(c => c.total !== row.precio && !(skipNoted && c.nota_precio));
  const totalOutdated = rows.reduce((acc, r) => acc + outdated(r).length, 0);

  const priceTag = (row: Plan) => (
    <span aria-label={`Precio de ${row.nombre}`} className="shrink-0 sm:min-w-[96px] text-right text-sm sm:text-base font-bold tabular-nums">
      {money(row.precio)}
    </span>
  );

  const editButton = (row: Plan) => (
    <button
      type="button"
      onClick={() => openDialog(isCombo(row) ? 'combo' : 'plan', row)}
      title="Editar nombre y precio"
      aria-label={`Editar ${row.nombre}`}
      className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
    >
      <Pencil size={16} />
    </button>
  );

  const clientsLine = (row: Plan) => {
    const count = clientsOf(row).length;
    const pending = outdated(row).length;
    return (
      <>
        {count} {count === 1 ? 'cliente' : 'clientes'}
        {pending > 0 && <span className="text-amber-600 font-semibold"> · {pending} con otro precio</span>}
      </>
    );
  };

  return (
    <div className="w-full pb-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-card rounded-[2rem] border border-border/60 shadow-xl p-5 md:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Layers className="text-primary" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight">Catálogo de plataformas</h3>
              <p className="text-xs text-muted-foreground">Definí el precio de cada plan y aplicalo a todos sus clientes de una vez.</p>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="plan-porcentaje" className={labelClass}>Aumento general</label>
              <div className="relative">
                <input
                  id="plan-porcentaje"
                  inputMode="decimal"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  placeholder="10"
                  className={`${inputClass} w-28 pr-8`}
                />
                <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <button type="button" onClick={applyPercent} className="h-11 px-4 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/80">
              Calcular
            </button>
          </div>
        </div>

        {platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay planes. Agregá el primero acá abajo o cargá clientes con su plataforma.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {platforms.map(row => {
              const inCombos = usedInCombos(row.nombre);
              return (
                <li key={row.nombre} className="py-3 flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold break-words">{row.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {clientsLine(row)}
                      {inCombos.length > 0 && <> · en {inCombos.length} {inCombos.length === 1 ? 'combo' : 'combos'}</>}
                    </p>
                  </div>
                  {priceTag(row)}
                  <div className="flex items-center shrink-0 -mr-2">
                  {editButton(row)}
                  <button
                    type="button"
                    disabled={inCombos.length > 0 || clientsOf(row).length > 0}
                    onClick={() => removeRow(row)}
                    title={
                      inCombos.length > 0 ? 'Forma parte de un combo: borrá el combo primero'
                      : clientsOf(row).length > 0 ? 'Tiene clientes: cambiales el plan antes de borrarla'
                      : 'Quitar del catálogo'
                    }
                    aria-label={`Quitar ${row.nombre} del catálogo`}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 size={16} />
                  </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button
          type="button"
          onClick={() => openDialog('plan')}
          className="h-11 px-5 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-all"
        >
          <Plus size={14} /> Nueva plataforma
        </button>
      </div>

      <div className="bg-card rounded-[2rem] border border-border/60 shadow-xl p-5 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
            <Package className="text-violet-600" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">Combos</h3>
            <p className="text-xs text-muted-foreground">Juntá dos o más plataformas con un precio especial. Se asignan a los clientes como cualquier plan.</p>
          </div>
        </div>

        {combos.length > 0 && (
          <ul className="divide-y divide-border border-y border-border">
            {combos.map(combo => {
              const suma = sumOf(combo, platforms);
              const ahorro = suma > 0 ? Math.round((1 - combo.precio / suma) * 100) : 0;
              return (
                <li key={combo.nombre} className="py-3 flex items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold break-words">{combo.nombre}</p>
                    <div className="flex flex-wrap gap-1">
                      {combo.plataformas!.map(p => (
                        <span key={p} className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold">{p}</span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {clientsLine(combo)} · por separado {money(suma)}
                      {ahorro > 0 && <span className="text-emerald-600 font-semibold"> · {ahorro}% de descuento</span>}
                    </p>
                  </div>
                  {priceTag(combo)}
                  <div className="flex items-center shrink-0 -mr-2">
                  {editButton(combo)}
                  <button
                    type="button"
                    disabled={clientsOf(combo).length > 0}
                    onClick={() => removeRow(combo)}
                    title={clientsOf(combo).length > 0 ? 'Tiene clientes: cambiales el plan antes de borrarlo' : 'Quitar combo'}
                    aria-label={`Quitar ${combo.nombre} del catálogo`}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Trash2 size={16} />
                  </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {platforms.length < 2 ? (
          <p className="text-sm text-muted-foreground">Cargá al menos dos plataformas para armar un combo.</p>
        ) : (
          <button
            type="button"
            onClick={() => openDialog('combo')}
            className="h-11 px-5 rounded-xl bg-violet-600 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-violet-600/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={14} /> Nuevo combo
          </button>
        )}
      </div>

      <div className="bg-card rounded-[2rem] border border-border/60 shadow-xl p-5 md:p-8 space-y-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={skipNoted} onChange={(e) => setSkipNoted(e.target.checked)} className="rounded border-border" />
          No cambiar el importe de los clientes que tienen una nota de precio (precios especiales)
        </label>

        <p className="text-xs text-muted-foreground">
          Los cambios del catálogo (agregar, editar o borrar) se guardan solos. Este botón lleva los precios del catálogo a los clientes.
        </p>

        {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={saving || totalOutdated === 0}
            onClick={() => commit(rows, { applyToClients: true })}
            className="h-12 px-6 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : `Aplicar precios a ${totalOutdated} ${totalOutdated === 1 ? 'cliente' : 'clientes'}`}
          </button>
        </div>
      </div>

      {affected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-900">
              Se actualizó el importe de {affected.length} {affected.length === 1 ? 'cliente' : 'clientes'}.
            </p>
            <p className="text-xs text-emerald-800/80">
              {affected.length > 0
                ? `Total nuevo de la cartera afectada: ${money(affected.reduce((acc, c) => acc + c.total, 0))}.`
                : 'No había clientes con un precio distinto.'}
            </p>
          </div>
          {affected.length > 0 && onNotify && (
            <button
              type="button"
              onClick={() => onNotify(affected)}
              className="h-12 px-5 rounded-xl bg-[#25D366] text-white font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <MessageCircle size={16} /> Avisar el aumento por WhatsApp
            </button>
          )}
        </div>
      )}

      {/* Las ventanas se dibujan en <body>: dentro de la pantalla animada quedaban debajo de la barra superior */}
      {dialog && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
          <form
            role="dialog"
            aria-label={editing !== null ? `Editar ${editing}` : dialog === 'combo' ? 'Nuevo combo' : 'Nueva plataforma'}
            onSubmit={confirmDialog}
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border p-6 space-y-5 max-h-[92vh] overflow-y-auto"
          >
            <h2 className="text-xl font-bold tracking-tight break-words">
              {editing !== null ? `Editar ${dialog === 'combo' ? 'combo' : 'plataforma'}` : dialog === 'combo' ? 'Nuevo combo' : 'Nueva plataforma'}
            </h2>

            {dialog === 'combo' && (
              <div className="space-y-2">
                <p className={labelClass}>Plataformas del combo</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => {
                    const selected = comboPlatforms.includes(p.nombre);
                    return (
                      <button
                        key={p.nombre}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePlatform(p.nombre)}
                        className={`px-3 h-9 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                          selected ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-foreground border-border hover:border-violet-300'
                        }`}
                      >
                        {selected && <Check size={12} />} {p.nombre}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {comboPlatforms.length >= 2 ? `Por separado suman ${money(comboSum)}.` : 'Elegí al menos dos plataformas.'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="nuevo-nombre" className={labelClass}>Nombre</label>
              <input
                id="nuevo-nombre"
                autoFocus={dialog === 'plan'}
                value={draftName}
                onChange={(e) => { setDraftName(e.target.value); setDraftError(''); }}
                placeholder={dialog === 'combo' ? (comboPlatforms.length >= 2 ? comboPlatforms.join(' + ') : 'Ej: Netflix + Disney') : 'Ej: Disney+ Premium'}
                className={`${inputClass} w-full`}
              />
            </div>

            <div className={`grid gap-3 ${showPercent ? 'grid-cols-[1fr_7.5rem]' : 'grid-cols-1'}`}>
              <div className="space-y-2">
                <label htmlFor="nuevo-precio" className={labelClass}>Precio</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                  <input
                    id="nuevo-precio"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={shownPrice}
                    onChange={(e) => { setDraftPrice(e.target.value); setPriceEdited(true); setDraftPercent(''); setDraftError(''); }}
                    className={`${inputClass} w-full pl-7`}
                  />
                </div>
              </div>
              {showPercent && (
                <div className="space-y-2">
                  <label htmlFor="nuevo-porcentaje" className={labelClass}>{dialog === 'combo' ? 'Descuento' : 'Ajuste'}</label>
                  <div className="relative">
                    <input
                      id="nuevo-porcentaje"
                      inputMode="decimal"
                      value={draftPercent}
                      onChange={(e) => { setDraftPercent(e.target.value); setDraftError(''); }}
                      placeholder={dialog === 'combo' ? '10' : '+10'}
                      className={`${inputClass} w-full pr-8`}
                    />
                    <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            {showPercent && (
              <p className="text-xs text-muted-foreground -mt-2">
                {dialog === 'combo'
                  ? comboPlatforms.length >= 2 && comboDiscount !== null
                    ? comboDiscount > 0
                      ? `${money(shownPriceValue)} en lugar de ${money(comboSum)}: ${comboDiscount}% de descuento.`
                      : comboDiscount < 0 ? `Sale ${Math.abs(comboDiscount)}% más caro que por separado.` : 'Mismo precio que por separado.'
                    : 'Poné un % de descuento y el precio se calcula solo.'
                  : shownPriceValue !== basePrice
                    ? `Antes ${money(basePrice)} → ahora ${money(shownPriceValue)} (${shownPriceValue > basePrice ? '+' : ''}${Math.round(((shownPriceValue - basePrice) / basePrice) * 100)}%).`
                    : 'Poné un % (ej: 10 para aumentar, -10 para bajar) y el precio se calcula solo.'}
              </p>
            )}

            {draftError && <p role="alert" className="text-sm text-rose-600 font-medium">{draftError}</p>}

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={() => confirmCloseDialog(closeDialog)} className="h-12 px-4 rounded-xl text-muted-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                className={`w-full sm:w-auto sm:flex-1 h-12 shrink-0 px-4 rounded-xl text-white font-bold text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 ${
                  dialog === 'combo' ? 'bg-violet-600 shadow-violet-600/20' : 'bg-primary shadow-primary/20'
                }`}
              >
                {editing !== null ? <><Save size={14} /> Guardar cambios</> : <><Plus size={14} /> {dialog === 'combo' ? 'Crear combo' : 'Agregar plataforma'}</>}
              </button>
            </div>
          </form>
        </div>
      , document.body)}

      {comboPrompt && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
          <div role="dialog" aria-label="Actualizar combos" className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight">¿Actualizar también los combos?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cambiaste el precio de plataformas que forman parte de estos combos. Te proponemos ajustarlos en la misma
                proporción, así mantienen el mismo descuento. Podés corregir cada precio.
              </p>
            </div>

            <ul className="divide-y divide-border border-y border-border">
              {comboPrompt.updates.map((u, i) => (
                <li key={u.nombre} className="py-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 flex-1 min-w-[160px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={u.aplicar}
                      aria-label={`Actualizar ${u.nombre}`}
                      onChange={(e) => setComboPrompt(p => p && { ...p, updates: p.updates.map((x, j) => (j === i ? { ...x, aplicar: e.target.checked } : x)) })}
                      className="rounded border-border"
                    />
                    <span>
                      <span className="block text-sm font-bold">{u.nombre}</span>
                      <span className="block text-xs text-muted-foreground">Ahora {money(u.actual)}</span>
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!u.aplicar}
                      aria-label={`Nuevo precio de ${u.nombre}`}
                      value={u.sugerido}
                      onChange={(e) => {
                        const value = Math.max(parseFloat(e.target.value) || 0, 0);
                        setComboPrompt(p => p && { ...p, updates: p.updates.map((x, j) => (j === i ? { ...x, sugerido: value } : x)) });
                      }}
                      className={`${inputClass} w-36 pl-7 disabled:opacity-40`}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => resolvePrompt(false)} className="flex-1 h-12 px-4 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest">
                No, dejar los combos igual
              </button>
              <button type="button" onClick={() => resolvePrompt(true)} className="flex-1 h-12 px-4 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
                Sí, actualizar combos
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default PlansView;
