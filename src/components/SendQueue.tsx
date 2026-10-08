import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, MessageCircle, SkipForward, Check, HandCoins } from 'lucide-react';
import { Client, CobroData } from '@/types/client';
import { DEFAULT_COBRO, DEFAULT_TEMPLATES, MessageTemplates, TemplateKey, buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

interface SendQueueProps {
  title: string;
  /** Clientes a recorrer; se toma la lista tal como está al abrir la cola. */
  clients: Client[];
  templates?: MessageTemplates;
  cobro?: CobroData;
  /** Plantilla fija para todos; si no se indica, la del segmento de cada cliente. */
  templateKey?: TemplateKey;
  onSent?: (client: Client, templateKey?: TemplateKey) => void;
  onRegisterPayment?: (client: Client) => void;
  onClose: () => void;
}

/** Recorre los clientes de a uno: abrir el chat, enviar y pasar al siguiente. */
const SendQueue = ({ title, clients, templates = DEFAULT_TEMPLATES, cobro = DEFAULT_COBRO, templateKey, onSent, onRegisterPayment, onClose }: SendQueueProps) => {
  const [queue] = useState(() => clients.filter(c => buildWhatsAppUrl(c, 'x') !== null));
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState(0);

  const client = queue[index];
  const message = client ? buildWhatsAppMessage(client, templates, cobro, templateKey) : '';
  const skippedNoPhone = clients.length - queue.length;

  const handleSend = () => {
    const url = buildWhatsAppUrl(client, message);
    if (!url) return;
    // Siempre la misma pestaña: en la compu no se acumula una pestaña de WhatsApp por cliente
    window.open(url, 'fiestacobra-whatsapp');
    onSent?.(client, templateKey);
    setSent(n => n + 1);
    setIndex(i => i + 1);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        role="dialog"
        aria-label="Cola de envío"
        className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="px-6 py-5 border-b border-border bg-secondary/20 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight truncate">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {client ? `Cliente ${index + 1} de ${queue.length}` : `${sent} de ${queue.length} enviados`}
              {skippedNoPhone > 0 && ` · ${skippedNoPhone} sin número`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar cola" className="p-2 rounded-full hover:bg-secondary transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="h-1 bg-secondary">
          <div className="h-full bg-[#25D366] transition-all duration-300" style={{ width: `${queue.length ? (index / queue.length) * 100 : 100}%` }} />
        </div>

        {client ? (
          <>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold uppercase">
                  {client.nombre.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{client.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-mono">{client.celular}</span>{client.plan && ` · ${client.plan}`}
                  </p>
                </div>
                <span className="font-bold">${client.total.toLocaleString('es-AR')}</span>
              </div>
              <div className="bg-[hsl(120_30%_95%)] rounded-2xl rounded-tl-none p-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                {message}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setIndex(i => i + 1)}
                className="h-14 px-4 rounded-2xl bg-white border border-border text-muted-foreground font-bold text-[10px] uppercase tracking-widest hover:text-foreground transition-all flex items-center gap-2"
              >
                <SkipForward size={16} /> Saltar
              </button>
              {onRegisterPayment && (
                <button
                  type="button"
                  onClick={() => onRegisterPayment(client)}
                  title="Registrar pago"
                  aria-label="Registrar pago"
                  className="h-14 px-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                  <HandCoins size={18} /> <span className="hidden sm:inline">Pagó</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSend}
                className="flex-1 h-14 rounded-2xl bg-[#25D366] text-white font-black text-[11px] uppercase tracking-[0.15em] shadow-lg shadow-[#25D366]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Enviar y seguir
              </button>
            </div>
          </>
        ) : (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-600">
              <Check size={30} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{queue.length === 0 ? 'No hay clientes para contactar' : 'Cola terminada'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {queue.length === 0 ? 'Ninguno de los clientes de este grupo tiene un número usable.' : `Abriste el chat de ${sent} de ${queue.length} clientes.`}
              </p>
            </div>
            <button type="button" onClick={onClose} className="h-12 px-8 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest">
              Cerrar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SendQueue;
