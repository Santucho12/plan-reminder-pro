import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pagado' | 'pendiente' | 'vencido';
}

const statusConfig = {
  pagado: {
    label: 'Pagado',
    className: 'bg-status-paid text-status-paid-text',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-status-pending text-status-pending-text',
  },
  vencido: {
    label: 'Vencido',
    className: 'bg-status-overdue text-status-overdue-text animate-pulse-subtle',
  },
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      config.className
    )}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
