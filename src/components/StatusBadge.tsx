import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Clock, Ban, CalendarDays } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const upperStatus = String(status).toUpperCase().trim();
  
  let styles = {
    className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    icon: Ban
  };
  
  // Lógica solicitada: 
  // Activo -> Verde, Vence hoy -> Rojo, Proximo a vencerse -> Amarillo, Vencido -> Gris
  
  if (upperStatus.includes('VENCE HOY') || upperStatus === 'HOY') {
    styles = {
      className: 'bg-rose-500/10 text-rose-600 border-rose-500/20 animate-pulse-subtle',
      icon: AlertCircle
    };
  } else if (upperStatus.includes('POR VENCER') || upperStatus.includes('PRÓXIMO') || upperStatus.includes('PENDIENTE')) {
    styles = {
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      icon: Clock
    };
  } else if (upperStatus.includes('ACTIVO')) {
    styles = {
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      icon: CheckCircle2
    };
  } else if (upperStatus.includes('VENCIDO') || upperStatus.includes('INACTIVO')) {
    styles = {
      className: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      icon: Ban
    };
  }

  const Icon = styles.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-300 shadow-sm",
      styles.className
    )}>
      <Icon size={12} strokeWidth={2.5} />
      {status}
    </span>
  );
};

export default StatusBadge;
