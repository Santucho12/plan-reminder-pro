import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Client } from '@/types/client';

interface MessagePreviewProps {
  client: Client | null;
  onClose: () => void;
}

const MessagePreview = ({ client, onClose }: MessagePreviewProps) => {
  if (!client) return null;

  const alias = 'Santi.abenel';
  const cbu = '0000003100092533873855';
  const total = client.total.toLocaleString('es-AR');
  const dias = Number(client.dias);

  const message = dias === 0
    ? `Hola Quería recordarte que hoy vence tu suscripción ⚠️
¿Vas a querer renovar? 

Debe abonar hoy! 💰 ${total}

cbu : ${cbu}
y alias : ${alias}`
    : dias > 0
      ? `Hola Quería recordarte que en 3 dias vence tu suscripción ⚠️
¿Vas a querer renovar? 

Debe abonar 💰 ${total}

cbu : ${cbu}
y alias : ${alias}`
      : dias <= -1 && dias >= -30
        ? `Hola 
Tú suscripción ya está vencida ⚠️

Vimos que aún no abonaste tu servicio, vas a querer renovar o procedemos con la baja? ❌

Muchas gracias!`
        : `Hola 👋🏼
Notamos que no renovas tu suscripción hace un tiempo⚠️
Te ofrecemos la oportunidad de reincorporarte con un 10% de descuento en cualquier plataforma que elijas 😁`;

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

      <div className="p-5 border-t border-border bg-slate-50">
        <button
          onClick={() => {
            const cleanPhone = client.celular.replace(/\D/g, '');
            // Si el número empieza con 11 o similar y le falta el 549, lo agregamos (opcional, pero mejor limpiar)
            const finalPhone = cleanPhone.length === 10 ? `549${cleanPhone}` : cleanPhone;
            window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank');
          }}
          className="w-full h-14 rounded-2xl bg-[#25D366] text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-[#25D366]/20 hover:shadow-[#25D366]/30 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <MessageSquare size={18} fill="white" />
          Enviar por WhatsApp
        </button>
        <p className="text-[10px] font-bold text-muted-foreground text-center mt-4 uppercase tracking-widest">
          Envío manual directo
        </p>
      </div>
    </motion.div>
  );
};

export default MessagePreview;
