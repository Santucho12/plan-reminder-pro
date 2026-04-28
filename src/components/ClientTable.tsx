import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, User, Phone, Zap, Calendar, DollarSign, Activity, Pencil, Trash2, MessageSquare } from 'lucide-react';
import { Client } from '@/types/client';
import StatusBadge from './StatusBadge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClientTableProps {
  clients: Client[];
  onSendMessage?: (client: Client) => void;
  onEdit?: (client: Client) => void;
  onDelete?: (clientId: string) => void;
}

const ClientTable = ({ clients, onSendMessage, onEdit, onDelete }: ClientTableProps) => {
  if (clients.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-card border border-border p-16 text-center flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Zap size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold">No se encontraron clientes</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
            Parece que no hay registros que coincidan con tu búsqueda o filtros actuales.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-card rounded-2xl shadow-premium border border-border overflow-hidden animate-in-slide">
        <div className="px-6 py-5 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            <h2 className="text-base font-bold tracking-tight uppercase text-muted-foreground/80">Clientes</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <span className="px-2 py-1 bg-secondary rounded-md">{clients.length} Resultados</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><User size={12} /> Cliente</div>
                </th>
                <th className="hidden md:table-cell text-left py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Phone size={12} /> Contacto</div>
                </th>
                <th className="hidden md:table-cell text-left py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Plataforma</th>
                <th className="text-left py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Calendar size={12} /> Vencimiento</div>
                </th>
                <th className="text-left py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Días</th>
                <th className="text-right py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center justify-end gap-2"><DollarSign size={12} /> Total</div>
                </th>
                <th className="text-center py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado</th>
                <th className="text-center py-4 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest lg:min-w-[200px]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {clients.map((client, index) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="group hover:bg-secondary/40 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shadow-sm">
                          {client.nombre.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 max-w-[110px] break-words whitespace-normal block">
                          {client.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                        {client.celular}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 max-w-[90px] align-middle text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="text-[10px] font-medium text-foreground/80 max-w-[90px] break-words whitespace-normal block mx-auto" style={{wordBreak: 'break-word', whiteSpace: 'normal'}}> 
                          {client.plan} 
                        </span>
                        {client.nota_plataforma && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary cursor-pointer hover:bg-primary hover:text-white transition-all hover:scale-110 shadow-sm border border-primary/20">
                                <MessageSquare size={10} fill="currentColor" fillOpacity={0.2} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs bg-slate-900 text-white border-none shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">Nota Plataforma</span>
                                <p className="text-xs font-semibold leading-relaxed">{client.nota_plataforma}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground/80">
                        {format(client.vencimiento, 'dd MMM yyyy', { locale: es })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`
                        inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                        ${Number(client.dias) < 0 ? 'bg-slate-100 text-slate-500' : 
                          Number(client.dias) === 0 ? 'bg-rose-100 text-rose-600 animate-pulse-subtle' : 
                          Number(client.dias) <= 3 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
                      `}>
                        {client.dias}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-bold text-foreground">
                          ${client.total.toLocaleString('es-AR')}
                        </span>
                        {client.nota_precio && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 cursor-pointer hover:bg-amber-500 hover:text-white transition-all hover:scale-110 shadow-sm border border-amber-200">
                                <MessageSquare size={10} fill="currentColor" fillOpacity={0.2} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs bg-slate-900 text-white border-none shadow-2xl rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Nota Precio</span>
                                <p className="text-xs font-semibold leading-relaxed">{client.nota_precio}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={client.estado} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onSendMessage?.(client)}
                          className="
                            inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider
                            bg-primary text-white shadow-lg shadow-primary/20 
                            hover:bg-primary/90 hover:shadow-primary/30 
                            active:scale-95 transition-all duration-200
                          "
                        >
                          <Send size={14} />
                          <span className="hidden lg:inline">Enviar</span>
                        </button>
                        
                        <button
                          onClick={() => onEdit?.(client)}
                          className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        
                        <button
                          onClick={() => onDelete?.(client.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ClientTable;
