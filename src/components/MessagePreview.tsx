import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';

interface MessagePreviewProps {
  client: Client | null;
  onClose: () => void;
}

const MessagePreview = ({ client, onClose }: MessagePreviewProps) => {
  if (!client) return null;

  const d = Number(client.dias);
  
  let headerTitle = "Recordatorio Regular";
  let headerColor = "text-primary";
  let message = "";

  if (d >= 0 && d <= 3) {
    headerTitle = "Recordatorio Proactivo";
    headerColor = "text-primary";
    message = `Hola ${client.nombre}, como estas? te recordamos que tu plan *${client.plan}* ${d === 0 ? 'venció hoy' : `vence en ${d} días`}. El total es *$${client.total.toLocaleString('es-AR')}*. Que tengas un buen día! 💪`;
  } else if (d < 0 && d >= -30) {
    headerTitle = "Cobranza Crítica";
    headerColor = "text-red-400";
    message = `Hola ${client.nombre}, notamos que tu plan *${client.plan}* ya se encuentra vencido. El total para renovarlo es *$${client.total.toLocaleString('es-AR')}*. Te mando el link de pago: 🔗 [Link Mercado Pago]. Gracias!`;
  } else if (d < -30) {
    headerTitle = "Recuperación de Cliente";
    headerColor = "text-orange-400";
    message = `Hola ${client.nombre}, notamos que hace un tiempo tu plan *${client.plan}* se encuentra vencido. El total para renovarlo es *$${client.total.toLocaleString('es-AR')}*. ¿Te gustaría renovarlo? Te mando el link de pago: 🔗 [Link Mercado Pago]`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed right-0 top-0 h-full w-[450px] bg-slate-950/80 backdrop-blur-2xl border-l border-white/5 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-50 flex flex-col"
    >
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
            <MessageSquare size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Componer</h3>
            <p className={cn("text-[10px] font-black uppercase tracking-widest", headerColor)}>{headerTitle}</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-all group"
        >
          <X size={20} className="text-muted-foreground group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
        </button>
      </div>

      <div className="flex-1 p-8 overflow-auto space-y-8">
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Destinatario</p>
          <div className="glass p-5 rounded-2xl border-white/5 space-y-1">
            <p className="text-lg font-black tracking-tighter text-white">{client.nombre}</p>
            <p className="text-sm font-mono text-muted-foreground">{client.celular}</p>
            <div className="pt-2 flex gap-2">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/60">{client.plan}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Vista Previa de Salida</p>
          <div className="relative">
             <div className="absolute top-0 left-0 w-3 h-3 bg-emerald-500/10 border-l border-t border-white/10 -ml-1 -mt-1 rounded-tl-sm rotate-45" />
             <div className="bg-emerald-500/5 border border-white/10 rounded-2xl rounded-tl-none p-6 text-sm leading-relaxed text-white/80 italic font-medium whitespace-pre-line shadow-[0_10px_30px_-5px_rgba(16,185,129,0.1)]">
              {message}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 border-t border-white/5 space-y-4">
        <button className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all">
          <MessageSquare size={18} strokeWidth={3} />
          Enviar Mensaje Directo
        </button>
        <p className="text-[10px] text-muted-foreground text-center font-bold px-4">
          Esta acción disparará un evento de envío manual a través de la API de WhatsApp vinculada.
        </p>
      </div>
    </motion.div>
  );
};

export default MessagePreview;
