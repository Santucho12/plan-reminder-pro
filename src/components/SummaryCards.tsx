import { motion } from 'framer-motion';
import { Users, AlertCircle, Clock, XCircle, Wallet, ArrowUpRight, Activity, TrendingUp } from 'lucide-react';
import { Client } from '@/types/client';

interface SummaryCardsProps {
  clients: Client[];
}

const SummaryCards = ({ clients }: SummaryCardsProps) => {
  const activeCount = clients.filter(c => {
    const d = Number(c.dias);
    return !isNaN(d) && d >= 0;
  }).length;
  
  const todayExpirations = clients.filter(c => Number(c.dias) === 0).length;
  const soonExpirations = clients.filter(c => {
    const d = Number(c.dias);
    return d >= 1 && d <= 3;
  }).length;
  const overdueCount = clients.filter(c => Number(c.dias) < 0).length;

  const totalFacturado = clients
    .filter(c => {
      const d = Number(c.dias);
      return !isNaN(d) && d >= 0;
    })
    .reduce((acc, client) => acc + (Number(client.total) || 0), 0);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  const cards = [
    {
      title: "Clientes Activos",
      value: activeCount,
      icon: Users,
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-100",
      accentColor: "bg-emerald-600"
    },
    {
      title: "Vencen hoy",
      value: todayExpirations,
      icon: AlertCircle,
      color: "bg-rose-50",
      iconColor: "text-rose-600",
      borderColor: "border-rose-100",
      accentColor: "bg-rose-600"
    },
    {
      title: "Próximos a vencerse",
      value: soonExpirations,
      icon: Clock,
      color: "bg-amber-50",
      iconColor: "text-amber-600",
      borderColor: "border-amber-100",
      accentColor: "bg-amber-600"
    },
    {
      title: "Vencidos",
      value: overdueCount,
      icon: XCircle,
      color: "bg-slate-50",
      iconColor: "text-slate-600",
      borderColor: "border-slate-100",
      accentColor: "bg-slate-600"
    }
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Grid Cards - Clean Interface Style */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {cards.map((card, index) => (
          <motion.div
            key={index}
            variants={item}
            className={`
              relative overflow-hidden rounded-xl border ${card.borderColor} 
              bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]
              hover:shadow-xl hover:shadow-slate-200/50
              transition-all duration-300
            `}
          >
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {card.title}
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900">
                    {card.value}
                  </h3>
                </div>
              </div>
              <div className={`rounded-lg p-2 ${card.color} ${card.iconColor} border ${card.borderColor}`}>
                <card.icon size={18} />
              </div>
            </div>
            
            {/* Minimalist Bottom Indicator */}
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Estado</span>
              <div className={`h-1.5 w-1.5 rounded-full ${card.accentColor}`} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Revenue Section - Professional Executive Style */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl p-8"
      >
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp size={16} />
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Facturación Mensual</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Analytics</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-slate-500 text-sm font-medium">Ingresos Totales (Mes en curso)</p>
              <div className="flex items-baseline gap-3">
                <h2 className="text-6xl font-extrabold tracking-tighter text-white font-display">
                  ${totalFacturado.toLocaleString('es-AR')}
                </h2>
                <div className="flex items-center gap-1 text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-0.5 rounded-md">
                  <ArrowUpRight size={14} />
                  <span>+12.5%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-4 p-5 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Estado general</p>
                <p className="text-white font-bold text-xl">Rendimiento Alto</p>
              </div>
              <Activity size={24} className="text-emerald-500 opacity-50" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-slate-500 tracking-tighter">Eficiencia de Cobro</span>
                <span className="text-emerald-400">92%</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '92%' }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Technical Background Decorative Elements */}
        <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Wallet size={120} strokeWidth={0.5} />
        </div>
      </motion.div>
    </div>
  );
};

export default SummaryCards;
