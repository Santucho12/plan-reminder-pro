import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, User, Phone, Zap, Calendar, DollarSign, Activity, Pencil, Trash2, MessageSquare, HandCoins } from 'lucide-react';
import { Client } from '@/types/client';
import { SEGUIMIENTO_LABELS } from '@/lib/whatsapp';
import { useIsMobile } from '@/hooks/use-mobile';
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
  onRegisterPayment?: (client: Client) => void;
  /** Abre la ficha del cliente (con el botón ⓘ al lado del nombre). */
  onOpen?: (client: Client) => void;
}

const diasClass = (dias: number) =>
  dias < 0 ? 'bg-slate-100 text-slate-500' :
  dias === 0 ? 'bg-rose-100 text-rose-600 animate-pulse-subtle' :
  dias <= 3 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600';

const SeguimientoChip = ({ client }: { client: Client }) =>
  client.seguimiento ? (
    <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-bold uppercase tracking-wider">
      {SEGUIMIENTO_LABELS[client.seguimiento]}
    </span>
  ) : null;

/** El nombre del cliente abre su ficha. */
const ClientName = ({ client, onOpen, className }: { client: Client; onOpen?: (client: Client) => void; className: string }) => {
  if (!onOpen) return <span className={className}>{client.nombre}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(client)}
      title="Ver ficha"
      aria-label={`Ver ficha de ${client.nombre}`}
      className={`${className} text-left hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors`}
    >
      {client.nombre}
    </button>
  );
};

const ClientTable = ({ clients, onSendMessage, onEdit, onDelete, onRegisterPayment, onOpen }: ClientTableProps) => {
  const isMobile = useIsMobile();

  if (clients.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-card border border-border p-10 md:p-16 text-center flex flex-col items-center gap-4"
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

  if (isMobile) {
    return (
      <div className="space-y-3">
        <p className="px-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{clients.length} Resultados</p>
        {clients.map(client => (
          <article key={client.id} className="bg-card rounded-2xl border border-border shadow-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                  {client.nombre.charAt(0)}
                </div>
                <div className="min-w-0">
                  <ClientName client={client} onOpen={onOpen} className="block max-w-full text-sm font-bold truncate" />
                  <p className="text-xs text-muted-foreground truncate">{client.plan || 'Sin plan'}</p>
                  <SeguimientoChip client={client} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">${client.total.toLocaleString('es-AR')}</p>
                <StatusBadge status={client.estado} />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Vence {format(client.vencimiento, 'dd MMM yyyy', { locale: es })}</span>
              <span className={`inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-full font-bold ${diasClass(Number(client.dias))}`}>
                {client.dias} d
              </span>
            </div>

            <div className="flex items-center gap-1.5 min-[380px]:gap-2">
              <button
                type="button"
                onClick={() => onSendMessage?.(client)}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-11 px-2 rounded-xl text-[13px] min-[380px]:text-sm font-bold bg-primary text-white active:scale-95 transition-all"
              >
                <Send size={15} /> WhatsApp
              </button>
              <button
                type="button"
                onClick={() => onRegisterPayment?.(client)}
                aria-label={`Registrar pago de ${client.nombre}`}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-11 px-2 rounded-xl text-[13px] min-[380px]:text-sm font-bold bg-emerald-600 text-white active:scale-95 transition-all"
              >
                <HandCoins size={16} /> Pagó
              </button>
              <button type="button" onClick={() => onEdit?.(client)} title="Editar" aria-label={`Editar ${client.nombre}`} className="h-11 w-10 min-[380px]:w-11 shrink-0 rounded-xl bg-secondary text-slate-500 flex items-center justify-center">
                <Pencil size={16} />
              </button>
              <button type="button" onClick={() => onDelete?.(client.id)} title="Eliminar" aria-label={`Eliminar ${client.nombre}`} className="h-11 w-10 min-[380px]:w-11 shrink-0 rounded-xl bg-secondary text-slate-500 flex items-center justify-center">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
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
                <th className="text-left py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><User size={12} /> Cliente</div>
                </th>
                <th className="hidden lg:table-cell text-left py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Phone size={12} /> Contacto</div>
                </th>
                <th className="hidden lg:table-cell text-left py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Plataforma</th>
                <th className="text-left py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center gap-2"><Calendar size={12} /> Vencimiento</div>
                </th>
                <th className="text-left py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Días</th>
                <th className="text-right py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <div className="flex items-center justify-end gap-2"><DollarSign size={12} /> Total</div>
                </th>
                <th className="text-center py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado</th>
                <th className="text-right py-3 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {clients.map((client) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="group hover:bg-secondary/40 transition-all duration-200"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase shadow-sm">
                          {client.nombre.charAt(0)}
                        </div>
                        <div>
                          <ClientName
                            client={client}
                            onOpen={onOpen}
                            className="text-xs font-semibold text-foreground line-clamp-2 max-w-[140px] break-words whitespace-normal block"
                          />
                          <SeguimientoChip client={client} />
                        </div>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2.5">
                      {client.celular ? (
                        <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">
                          {client.celular}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70 italic">Sin número</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-2.5 max-w-[170px] align-middle">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground/80 line-clamp-2 break-words" title={client.plan}>
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
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">
                        {format(client.vencimiento, 'dd MMM yy', { locale: es })}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold ${diasClass(Number(client.dias))}`}>
                        {client.dias}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-bold text-foreground whitespace-nowrap">
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
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge status={client.estado} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onSendMessage?.(client)}
                          title="Enviar WhatsApp"
                          className="
                            inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap
                            bg-primary text-white shadow-lg shadow-primary/20
                            hover:bg-primary/90 hover:shadow-primary/30
                            active:scale-95 transition-all duration-200
                          "
                        >
                          <Send size={13} />
                          <span className="hidden 2xl:inline">WhatsApp</span>
                        </button>

                        <button
                          onClick={() => onRegisterPayment?.(client)}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all whitespace-nowrap"
                          title="Registrar que el cliente pagó"
                          aria-label={`Registrar pago de ${client.nombre}`}
                        >
                          <HandCoins size={14} />
                          <span>Pagó</span>
                        </button>

                        <button
                          onClick={() => onEdit?.(client)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => onDelete?.(client.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
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
