import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, BadgeDollarSign, Check, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Client, CobroData } from '@/types/client';
import { computeRenewal } from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { DEFAULT_COBRO, DEFAULT_TEMPLATES, MessageTemplates, buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

export interface PaymentInput {
  monto: number;
  medio: string;
  vencimientoNuevo: string;
}

interface PaymentDialogProps {
  client: Client;
  templates?: MessageTemplates;
  cobro?: CobroData;
  onClose: () => void;
  onConfirm: (input: PaymentInput) => Promise<void>;
  /** Se avisó al cliente con la plantilla de pago recibido. */
  onNotified?: (client: Client) => void;
}

const MEDIOS = ['Transferencia', 'Efectivo', 'Billetera virtual', 'Otro'];
const MESES = [1, 2, 3, 6, 12];
const inputClass = 'w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all';
const labelClass = 'text-[10px] font-black text-muted-foreground uppercase tracking-widest';

const PaymentDialog = ({ client, templates = DEFAULT_TEMPLATES, cobro = DEFAULT_COBRO, onClose, onConfirm, onNotified }: PaymentDialogProps) => {
  const [monto, setMonto] = useState(client.total);
  const [medio, setMedio] = useState(MEDIOS[0]);
  const [meses, setMeses] = useState(1);
  const [vencimientoNuevo, setVencimientoNuevo] = useState(() => computeRenewal(client.vencimiento, 1));
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const confirmDiscard = useUnsavedChanges(
    !done && (monto !== client.total || medio !== MEDIOS[0] || meses !== 1 || vencimientoNuevo !== computeRenewal(client.vencimiento, 1)),
  );
  const close = () => confirmDiscard(onClose);

  // El nuevo vencimiento tiene que avanzar: después del actual y después de hoy (si no, el cliente
  // queda vencido aunque haya pagado)
  const today = format(new Date(), 'yyyy-MM-dd');
  const current = format(client.vencimiento, 'yyyy-MM-dd');
  const invalid =
    !(monto > 0) ? 'El monto tiene que ser mayor a $0.'
    : !vencimientoNuevo ? 'Elegí el nuevo vencimiento.'
    : vencimientoNuevo <= current ? 'El nuevo vencimiento tiene que ser posterior al actual.'
    : vencimientoNuevo <= today ? 'El nuevo vencimiento tiene que ser posterior a hoy.'
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || invalid) return;
    setSaving(true);
    try {
      await onConfirm({ monto, medio, vencimientoNuevo });
      setDone(true);
    } catch {
      // El error lo informa quien registra; el formulario queda abierto para reintentar
    } finally {
      setSaving(false);
    }
  };

  // El comprobante se arma con lo que se acaba de cobrar y el vencimiento ya renovado
  const paidClient: Client = { ...client, total: monto, vencimiento: new Date(`${vencimientoNuevo}T12:00:00`) };
  const receiptUrl = done ? buildWhatsAppUrl(client, buildWhatsAppMessage(paidClient, templates, cobro, 'paid')) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog"
        aria-label="Registrar pago"
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="px-6 py-5 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <BadgeDollarSign size={18} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Registrar pago</h2>
              <p className="text-xs text-muted-foreground">{client.nombre}{client.plan && ` · ${client.plan}`}</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-600">
              <Check size={30} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Pago registrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Renovado hasta el {format(paidClient.vencimiento, 'dd/MM/yyyy')}.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/80 transition-all">
                Listo
              </button>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(receiptUrl, '_blank');
                    onNotified?.(client);
                    onClose();
                  }}
                  className="flex-[2] h-12 rounded-xl bg-[#25D366] text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-[#25D366]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} /> Avisar por WhatsApp
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="pago-monto" className={labelClass}>Monto cobrado</label>
                <input
                  id="pago-monto"
                  required
                  type="number"
                  min="0"
                  value={monto}
                  onChange={(e) => setMonto(Math.max(parseFloat(e.target.value) || 0, 0))}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pago-medio" className={labelClass}>Medio de pago</label>
                <select id="pago-medio" value={medio} onChange={(e) => setMedio(e.target.value)} className={inputClass}>
                  {MEDIOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="pago-meses" className={labelClass}>Renueva por</label>
                <select
                  id="pago-meses"
                  value={meses}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setMeses(value);
                    setVencimientoNuevo(computeRenewal(client.vencimiento, value));
                    // Se cobran todos los meses que se renuevan (se puede corregir a mano)
                    setMonto(client.total * value);
                  }}
                  className={inputClass}
                >
                  {MESES.map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : 'meses'}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="pago-vencimiento" className={labelClass}>Nuevo vencimiento</label>
                <input
                  id="pago-vencimiento"
                  required
                  type="date"
                  value={vencimientoNuevo}
                  onChange={(e) => setVencimientoNuevo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Vencimiento actual: {format(client.vencimiento, 'dd/MM/yyyy')}. Podés ajustar la nueva fecha si acordaron otra.
            </p>

            {invalid && <p role="alert" className="text-sm text-rose-600 font-medium">{invalid}</p>}

            <div className="pt-2 flex gap-3">
              <button type="button" onClick={close} className="flex-1 h-12 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/80 transition-all">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !!invalid}
                className="flex-[2] h-12 rounded-xl bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Check size={16} /> {saving ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentDialog;
