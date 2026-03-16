import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, Users, Clock } from 'lucide-react';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface ClientTableProps {
  clients: Client[];
  onSendMessage?: (client: Client) => void;
}

const ClientTable = ({ clients, onSendMessage }: ClientTableProps) => {
  if (clients.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-16 text-center space-y-4"
      >
        <div className="mx-auto w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-6">
          <Users className="text-muted-foreground/40" size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold">Sin clientes en el radar</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">Tu base de datos está vacía. Importá un Excel para empezar a cobrar en automático.</p>
        </div>
        <button 
          className="mt-4 px-6 py-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm font-bold hover:bg-primary/20 transition-all hover:scale-105 active:scale-95"
        >
          Ir a Cargar Excel
        </button>
      </motion.div>
    );
  }

  return (
    <div className="glass-card border border-white/5 shadow-2xl overflow-hidden rounded-2xl">
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-white">Listado de Clientes</h2>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">{clients.length} Total</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={12} />
          Actualizado hace instantes
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.01]">
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Fiel al plan</th>
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Contacto</th>
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Plataforma</th>
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Vencimiento</th>
              <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Días</th>
              <th className="text-right text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Monto</th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Estado</th>
              <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {clients.map((client, index) => (
              <motion.tr
                key={client.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02, duration: 0.3 }}
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.03)", x: 4 }}
                className="group transition-all"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                    {client.nombre}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-xs font-mono text-muted-foreground/80 group-hover:text-white transition-colors">{client.celular}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    <span className="text-sm text-foreground/80 group-hover:text-foreground">{client.plan}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-xs font-mono text-white/90">
                    {format(client.vencimiento, 'dd MMM yyyy', { locale: es })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={cn(
                    "text-xs font-mono font-black",
                    Number(client.dias) < 0 ? "text-red-400" : Number(client.dias) <= 3 ? "text-orange-400" : "text-emerald-400"
                  )}>
                    {Number(client.dias) > 0 ? `+${client.dias}` : client.dias}
                  </span>
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <span className="text-sm font-mono font-bold text-glow text-white">
                    ${client.total.toLocaleString('es-AR')}
                  </span>
                </td>
                <td className="px-6 py-4 text-center whitespace-nowrap">
                  <StatusBadge status={client.estado} />
                </td>
                <td className="px-6 py-4 text-center whitespace-nowrap">
                  <button
                    onClick={() => onSendMessage?.(client)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-emerald-950 hover:bg-emerald-400 hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)] active:scale-[0.95] transition-all"
                  >
                    <Send size={12} strokeWidth={3} />
                    Cobrar
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClientTable;
