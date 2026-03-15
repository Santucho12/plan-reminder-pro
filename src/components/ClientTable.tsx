import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, MoreHorizontal } from 'lucide-react';
import { Client } from '@/types/client';
import StatusBadge from './StatusBadge';

interface ClientTableProps {
  clients: Client[];
  onSendMessage?: (client: Client) => void;
}

const ClientTable = ({ clients, onSendMessage }: ClientTableProps) => {
  if (clients.length === 0) {
    return (
      <div className="bg-card rounded-lg shadow-card border border-border p-12 text-center">
        <p className="text-muted-foreground">No hay clientes cargados aún.</p>
        <p className="text-sm text-muted-foreground mt-1">Cargá un Excel para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">Clientes</h2>
        <span className="text-sm text-muted-foreground">{clients.length} registros</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Clientes</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Telefono</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Plataformas</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Vencimiento</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Alertas</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Dias</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Total</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Estado</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">Accion</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <motion.tr
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors"
              >
                <td className="px-5 py-3.5">
                  <span className="text-sm font-medium text-foreground">
                    {client.nombre}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-mono text-muted-foreground">{client.celular}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm text-foreground">{client.plan}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-mono text-foreground">
                    {format(client.vencimiento, 'dd MMM yyyy', { locale: es })}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs text-muted-foreground">{client.alertas}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-xs font-mono text-foreground">{client.dias}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-sm font-mono font-medium text-foreground">
                    ${client.total.toLocaleString('es-AR')}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  <StatusBadge status={client.estado} />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => onSendMessage?.(client)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
                  >
                    <Send size={12} strokeWidth={1.5} />
                    Enviar
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
