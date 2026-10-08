import { useCallback, useEffect, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, MessageCircle, BadgeDollarSign, Pencil, StickyNote, Flag, Send, UserX, UserCheck } from 'lucide-react';
import { Client, ClientEvent, CobroData, Payment } from '@/types/client';
import { addClientEvent, fetchClientEvents } from '@/lib/api';
import {
  DEFAULT_COBRO,
  DEFAULT_TEMPLATES,
  MessageTemplates,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TemplateKey,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getSegment,
} from '@/lib/whatsapp';
import StatusBadge from './StatusBadge';
import { userMessage } from '@/lib/errors';

interface ClientSheetProps {
  client: Client;
  userId: string;
  /** Pagos de este cliente. */
  payments?: Payment[];
  templates?: MessageTemplates;
  cobro?: CobroData;
  onClose: () => void;
  onEdit?: (client: Client) => void;
  onRegisterPayment?: (client: Client) => void;
  onSent?: (client: Client, templateKey: TemplateKey) => void;
  /** Da de baja al cliente (o lo reactiva si ya estaba de baja). */
  onToggleBaja?: (client: Client) => Promise<void>;
}

type TimelineItem = { id: string; date: Date; icon: typeof Send; color: string; title: string; detail?: string };

const EVENT_STYLE: Record<ClientEvent['tipo'], { icon: typeof Send; color: string; title: string }> = {
  mensaje: { icon: MessageCircle, color: 'bg-[#25D366]/15 text-[#128C7E]', title: 'Mensaje enviado' },
  nota: { icon: StickyNote, color: 'bg-amber-100 text-amber-700', title: 'Nota' },
  estado: { icon: Flag, color: 'bg-violet-100 text-violet-700', title: 'Seguimiento' },
};

const ClientSheet = ({ client, userId, payments = [], templates = DEFAULT_TEMPLATES, cobro = DEFAULT_COBRO, onClose, onEdit, onRegisterPayment, onSent, onToggleBaja }: ClientSheetProps) => {
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>(() => getSegment(client) ?? 'soon');
  const [togglingBaja, setTogglingBaja] = useState(false);
  const deBaja = client.seguimiento === 'baja';
  const confirmDiscard = useUnsavedChanges(note.trim() !== '');
  const close = () => confirmDiscard(onClose);

  const loadEvents = useCallback(() => {
    fetchClientEvents(client.id)
      .then(setEvents)
      .catch(err => console.error('Error loading client events:', err));
  }, [client.id]);

  // Se vuelve a leer cuando cambia el cliente (un mensaje o un cambio de seguimiento suman eventos)
  useEffect(loadEvents, [loadEvents, client.ultimoMensaje, client.seguimiento]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    setError('');
    try {
      const event = await addClientEvent(userId, client.id, 'nota', text);
      setEvents(prev => [event, ...prev]);
      setNote('');
    } catch (err: any) {
      setError(userMessage(err, 'No se pudo guardar la nota'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBaja = async () => {
    if (!onToggleBaja || togglingBaja) return;
    setTogglingBaja(true);
    setError('');
    try {
      await onToggleBaja(client);
    } catch (err: any) {
      setError(userMessage(err, 'No se pudo actualizar el cliente'));
    } finally {
      setTogglingBaja(false);
    }
  };

  const message = buildWhatsAppMessage(client, templates, cobro, templateKey);
  const url = buildWhatsAppUrl(client, message);

  const timeline: TimelineItem[] = [
    ...payments.map(p => ({
      id: `p-${p.id}`,
      date: new Date(p.created_at || `${p.fecha_pago}T12:00:00`),
      icon: BadgeDollarSign,
      color: 'bg-emerald-100 text-emerald-700',
      title: `Pago de $${Number(p.monto).toLocaleString('es-AR')}`,
      detail: [p.medio, p.vencimiento_nuevo && `renovado hasta el ${p.vencimiento_nuevo.split('-').reverse().join('/')}`].filter(Boolean).join(' · '),
    })),
    ...events.map(e => ({ id: `e-${e.id}`, date: new Date(e.created_at), ...EVENT_STYLE[e.tipo], detail: e.detalle })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/50 backdrop-blur-sm animate-in-fade" onClick={close}>
      <motion.aside
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        role="dialog"
        aria-label={`Ficha de ${client.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full sm:w-[460px] bg-card border-l border-border shadow-elevated flex flex-col"
      >
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="w-12 h-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg uppercase">
            {client.nombre.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold truncate">{client.nombre}</h3>
            <p className="text-xs font-mono text-muted-foreground">{client.celular || 'Sin número'}</p>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar ficha" className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Plataforma</p>
              <p className="font-semibold break-words">{client.plan || '—'}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Importe</p>
              <p className="font-semibold">${client.total.toLocaleString('es-AR')}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vencimiento</p>
              <p className="font-semibold">{format(client.vencimiento, 'dd MMM yyyy', { locale: es })}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3 space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado</p>
              <StatusBadge status={client.estado} />
            </div>
          </div>

          {(client.nota_plataforma || client.nota_precio) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
              {client.nota_plataforma && <p><span className="font-bold">Nota plataforma:</span> {client.nota_plataforma}</p>}
              {client.nota_precio && <p><span className="font-bold">Nota precio:</span> {client.nota_precio}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onRegisterPayment?.(client)}
              className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <BadgeDollarSign size={16} /> Registrar pago
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(client)}
              className="flex-1 h-11 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Pencil size={14} /> Editar datos
            </button>
          </div>

          {onToggleBaja && (
            <div className="space-y-1">
              {deBaja && (
                <p className="text-xs font-semibold text-rose-700">
                  Dado de baja: no aparece en Mensajes ni cuenta en el dashboard.
                </p>
              )}
              <button
                type="button"
                onClick={handleToggleBaja}
                disabled={togglingBaja}
                className={`w-full h-10 rounded-xl border font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                  deBaja ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                }`}
              >
                {deBaja ? <><UserCheck size={14} /> Reactivar cliente</> : <><UserX size={14} /> Dar de baja</>}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="ficha-plantilla" className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Enviar mensaje</label>
            <div className="flex gap-2">
              <select
                id="ficha-plantilla"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value as TemplateKey)}
                className="flex-1 min-w-0 h-11 rounded-xl bg-secondary/40 border-none px-3 text-sm font-semibold"
              >
                {TEMPLATE_KEYS.map(key => <option key={key} value={key}>{TEMPLATE_LABELS[key]}</option>)}
              </select>
              <button
                type="button"
                disabled={!url}
                onClick={() => {
                  if (!url) return;
                  window.open(url, '_blank');
                  onSent?.(client, templateKey);
                }}
                className="h-11 px-4 rounded-xl bg-[#25D366] text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-40"
              >
                <MessageCircle size={16} /> Abrir chat
              </button>
            </div>
            <div className="bg-[hsl(120_30%_95%)] rounded-xl rounded-tl-none p-3 text-xs leading-relaxed whitespace-pre-line text-slate-700">
              {message}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Historial</p>
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Agregar una nota..."
                aria-label="Nueva nota"
                className="flex-1 min-w-0 h-11 rounded-xl bg-secondary/40 border-none px-3 text-sm"
              />
              <button type="submit" disabled={saving || note.trim() === ''} className="h-11 px-4 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-40">
                Guardar
              </button>
            </form>
            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay movimientos de este cliente.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map(item => (
                  <li key={item.id} className="flex gap-3">
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${item.color}`}>
                      <item.icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">{item.title}</p>
                      {item.detail && <p className="text-xs text-muted-foreground break-words whitespace-pre-line">{item.detail}</p>}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{format(item.date, "dd/MM/yyyy 'a las' HH:mm")}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </motion.aside>
    </div>
  );
};

export default ClientSheet;
