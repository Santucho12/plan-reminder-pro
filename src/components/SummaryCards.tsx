import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { Client } from '@/types/client';
import { startOfDay, isSameMonth } from 'date-fns';

interface SummaryCardsProps {
  clients: Client[];
}

const SummaryCards = ({ clients }: SummaryCardsProps) => {
  const activas = clients.filter(c => Number(c.dias || 0) >= 0).length;
  const vencenHoy = clients.filter(c => Number(c.dias || -1) === 0).length;
  const proximos = clients.filter(c => {
    const d = Number(c.dias);
    return d >= 1 && d <= 3;
  }).length;
  const vencidos = clients.filter(c => Number(c.dias || 0) <= -1).length;

  const totalFacturadoFact = clients
    .filter(c => Number(c.dias || -1) >= 0)
    .reduce((acc, client) => acc + (Number(client.total) || 0), 0);

  const cards = [
    {
      label: 'Clientes Activos',
      value: activas,
      icon: CheckCircle,
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      accent: 'emerald',
    },
    {
      label: 'Vencen Hoy',
      value: vencenHoy,
      icon: Clock,
      gradient: 'from-orange-500/20 to-orange-500/5',
      accent: 'orange',
    },
    {
      label: 'Próximos (1-3 días)',
      value: proximos,
      icon: Clock,
      gradient: 'from-blue-500/20 to-blue-500/5',
      accent: 'blue',
    },
    {
      label: 'Vencidos',
      value: vencidos,
      icon: AlertTriangle,
      gradient: 'from-red-500/20 to-red-500/5',
      accent: 'red',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                duration: 0.4, 
                delay: i * 0.08,
                type: 'spring',
                stiffness: 100 
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`glass-card relative overflow-hidden group p-6`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.gradient} rounded-bl-full opacity-50 group-hover:scale-110 transition-transform`} />
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-background/50 border border-white/5 shadow-inner`}>
                    <Icon size={18} className={`text-${card.accent}-400`} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">{card.label}</span>
                </div>
                
                <h3 className="text-4xl font-extrabold tracking-tighter">
                  {card.value}
                </h3>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.005 }}
        className="glass-card relative overflow-hidden p-8 border-primary/20 bg-gradient-to-r from-emerald-500/10 via-background/40 to-background/40"
      >
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary animate-pulse" size={20} />
              <span className="text-sm font-bold uppercase tracking-widest text-primary/80">Rendimiento Mensual</span>
            </div>
            <h2 className="text-sm text-muted-foreground font-medium">Total Facturado (Mes Actual)</h2>
            <p className="text-5xl md:text-6xl font-black tracking-tighter text-glow text-primary">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalFacturadoFact)}
            </p>
          </div>
          
          <div className="hidden lg:block">
            <div className="p-6 rounded-3xl bg-primary/10 border border-primary/20 shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]">
              <TrendingUp size={48} className="text-primary" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SummaryCards;
