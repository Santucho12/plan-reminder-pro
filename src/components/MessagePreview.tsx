import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Client } from '@/types/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MessagePreviewProps {
  client: Client | null;
  onClose: () => void;
}

const MessagePreview = ({ client, onClose }: MessagePreviewProps) => {
  if (!client) return null;

  const daysText = client.estado === 'vencido'
    ? 'se venció'
    : client.estado === 'pendiente'
      ? 'está por vencer'
      : 'está al día';

  const message = client.estado === 'vencido'
    ? `Hola ${client.nombre}, te informamos que tu plan *${client.plan}* venció el ${format(client.vencimiento, "dd 'de' MMMM", { locale: es })}. El total es *$${client.total.toLocaleString('es-AR')}*.\n\nPodés pagar desde este link:\n🔗 (se genera automáticamente al ejecutar recordatorios)\n\n¡Gracias!`
    : `Hola ${client.nombre}, te recordamos que tu plan *${client.plan}* vence el ${format(client.vencimiento, "dd 'de' MMMM", { locale: es })}. El total es *$${client.total.toLocaleString('es-AR')}*.\n\n¡Que tengas un gran día! 💪`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 h-full w-[400px] bg-card border-l border-border shadow-elevated z-50 flex flex-col"
    >
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} strokeWidth={1.5} className="text-primary" />
          <h3 className="text-sm font-semibold">Vista previa del mensaje</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary transition-colors">
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

      <div className="p-5 border-t border-border">
        <button className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all">
          <MessageSquare size={16} strokeWidth={1.5} />
          Enviar por WhatsApp
        </button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Requiere configurar la integración de WhatsApp
        </p>
      </div>
    </motion.div>
  );
};

export default MessagePreview;
