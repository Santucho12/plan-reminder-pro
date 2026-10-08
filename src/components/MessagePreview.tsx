import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Client, CobroData } from '@/types/client';
import { DEFAULT_COBRO, DEFAULT_TEMPLATES, MessageTemplates, buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

interface MessagePreviewProps {
  client: Client | null;
  templates?: MessageTemplates;
  cobro?: CobroData;
  onClose: () => void;
  onSent?: (client: Client) => void;
}

const MessagePreview = ({ client, templates = DEFAULT_TEMPLATES, cobro = DEFAULT_COBRO, onClose, onSent }: MessagePreviewProps) => {
  if (!client) return null;

  const message = buildWhatsAppMessage(client, templates, cobro);
  const url = buildWhatsAppUrl(client, message);

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-card border-l border-border shadow-elevated z-[70] flex flex-col"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} strokeWidth={1.5} className="text-primary" />
          <h3 className="text-sm font-semibold">Vista previa del mensaje</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar vista previa" className="p-1 rounded-md hover:bg-secondary transition-colors">
          <X size={18} strokeWidth={1.5} className="text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 p-5 overflow-auto">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">Destinatario</p>
          <p className="text-sm font-medium">{client.nombre} {client.apellido}</p>
          <p className="text-sm font-mono text-muted-foreground">{client.celular}</p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Mensaje WhatsApp</p>
          <div className="bg-[hsl(120_30%_95%)] rounded-lg rounded-tl-none p-4 text-sm leading-relaxed whitespace-pre-line">
            {message}
          </div>
        </div>
      </div>

      <div className="p-5 border-t border-border bg-slate-50">
        <button
          disabled={!url}
          onClick={() => {
            if (!url) return;
            window.open(url, '_blank');
            onSent?.(client);
          }}
          className="w-full h-14 rounded-2xl bg-[#25D366] text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-[#25D366]/20 hover:shadow-[#25D366]/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MessageSquare size={18} fill="white" />
          {url ? 'Enviar por WhatsApp' : 'Cliente sin número'}
        </button>
        <p className="text-[10px] font-bold text-muted-foreground text-center mt-4 uppercase tracking-widest">
          Se abre el chat con el mensaje listo
        </p>
      </div>
    </motion.div>
  );
};

export default MessagePreview;
