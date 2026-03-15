import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle, Send } from 'lucide-react';
import { Client } from '@/types/client';
import { differenceInDays, startOfDay } from 'date-fns';

interface SummaryCardsProps {
  clients: Client[];
}

const SummaryCards = ({ clients }: SummaryCardsProps) => {
  const today = startOfDay(new Date());

  const vencidosHoy = clients.filter(c => {
    const diff = differenceInDays(startOfDay(c.vencimiento), today);
    return diff === 0;
  }).length;

  const proximos3Dias = clients.filter(c => {
    const diff = differenceInDays(startOfDay(c.vencimiento), today);
    return diff > 0 && diff <= 3;
  }).length;

  const vencidos = clients.filter(c => c.estado === 'vencido').length;
  const pagados = clients.filter(c => c.estado === 'pagado').length;

  const cards = [
    {
      label: 'Vencen hoy',
      value: vencidosHoy,
      icon: AlertTriangle,
      color: 'text-status-overdue-text',
      bg: 'bg-status-overdue',
    },
    {
      label: 'Próximos 3 días',
      value: proximos3Dias,
      icon: Clock,
      color: 'text-status-pending-text',
      bg: 'bg-status-pending',
    },
    {
      label: 'Vencidos',
      value: vencidos,
      icon: AlertTriangle,
      color: 'text-status-overdue-text',
      bg: 'bg-status-overdue',
    },
    {
      label: 'Al día',
      value: pagados,
      icon: CheckCircle,
      color: 'text-status-paid-text',
      bg: 'bg-status-paid',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-lg p-5 shadow-card border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <div className={`${card.bg} p-2 rounded-md`}>
                <Icon size={16} strokeWidth={1.5} className={card.color} />
              </div>
            </div>
            <p className="text-3xl font-semibold tracking-tighter font-mono">{card.value}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SummaryCards;
