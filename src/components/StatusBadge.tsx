import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
}

const statusConfig = {
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
  const s = String(status).toUpperCase();
  
  let styles = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  let dotColor = "bg-slate-400";
  
  if (s.includes('VENCIDO') || s === 'DEUDA') {
    styles = "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.3)] animate-pulse-subtle";
    dotColor = "bg-red-500";
  } else if (s.includes('POR VENCER') || s.includes('PENDIENTE') || s === 'VENCE HOY' || s === 'HOY') {
    styles = "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_15px_-5px_rgba(249,115,22,0.3)]";
    dotColor = "bg-orange-500";
  } else if (s.includes('ACTIVO') || s.includes('PAGADO') || s === 'OK') {
    styles = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]";
    dotColor = "bg-emerald-500";
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
      styles
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor]", dotColor)} />
      {status}
    </span>
  );
};

export default StatusBadge;
