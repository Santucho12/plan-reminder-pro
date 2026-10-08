import { motion } from 'framer-motion';
import { Users, AlertCircle, Clock, XCircle, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, Undo2 } from 'lucide-react';
import { Client, Payment } from '@/types/client';
import { computeStats } from '@/lib/stats';

interface SummaryCardsProps {
  clients: Client[];
  payments?: Payment[];
  onUndoPayment?: (payment: Payment) => void;
}

const money = (value: number) => `$${value.toLocaleString('es-AR')}`;
const day = (value: string) => value.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

const SummaryCards = ({ clients, payments = [], onUndoPayment }: SummaryCardsProps) => {
  const stats = computeStats(clients, payments);
  const maxMes = Math.max(...stats.meses.map(m => m.total), 1);
  const maxPlan = Math.max(...stats.plataformas.map(p => p.total), 1);
  const recent = payments.slice(0, 5);

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
      title: "Activos",
      value: stats.activos,
      detail: "Con el plan vigente",
      icon: Users,
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
      borderColor: "border-emerald-100",
      accentColor: "bg-emerald-600"
    },
    {
      title: "Vencen hoy",
      value: stats.vencenHoy,
      detail: "Se cobran hoy",
      icon: AlertCircle,
      color: "bg-rose-50",
      iconColor: "text-rose-600",
      borderColor: "border-rose-100",
      accentColor: "bg-rose-600"
    },
    {
      title: "Por vencer",
      value: stats.porVencer,
      detail: "En 1 a 3 días",
      icon: Clock,
      color: "bg-amber-50",
      iconColor: "text-amber-600",
      borderColor: "border-amber-100",
      accentColor: "bg-amber-600"
    },
    {
      title: "Vencidos",
      value: stats.vencidos,
      detail: stats.enRecuperacion > 0
        ? `Hace 1 a 30 días · ${stats.enRecuperacion} en recuperación`
        : "Hace 1 a 30 días",
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
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        {cards.map((card, index) => (
          <motion.div
            key={index}
            variants={item}
            className={`
              relative overflow-hidden rounded-xl border ${card.borderColor}
              bg-white p-4 md:p-6 flex flex-col shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]
              hover:shadow-xl hover:shadow-slate-200/50
              transition-all duration-300
            `}
          >
            <div className="flex justify-between items-start gap-2 relative z-10">
              <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">
                  {card.title}
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-bold tracking-tight text-slate-900">
                    {card.value}
                  </h3>
                </div>
              </div>
              <div className={`shrink-0 rounded-lg p-1.5 md:p-2 ${card.color} ${card.iconColor} border ${card.borderColor}`}>
                <card.icon size={18} />
              </div>
            </div>

            {/* Minimalist Bottom Indicator */}
            <div className="mt-auto pt-4">
            <div className="pt-3 md:pt-4 border-t border-slate-50 flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase leading-snug">{card.detail}</span>
              <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${card.accentColor}`} />
            </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Revenue Section - Professional Executive Style */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl p-5 md:p-8"
      >
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <TrendingUp size={16} />
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Cobranza del mes</p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-500 text-sm font-medium">
                Cobrado este mes · {stats.pagosMes} {stats.pagosMes === 1 ? 'pago registrado' : 'pagos registrados'}
              </p>
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 data-testid="cobrado-mes" className="text-4xl md:text-6xl font-extrabold tracking-tighter text-white font-display">
                  {money(stats.cobradoMes)}
                </h2>
                {stats.variacion !== null && (
                  <div className={`flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-md ${stats.variacion >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'}`}>
                    {stats.variacion >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span>{stats.variacion >= 0 ? '+' : ''}{stats.variacion}% vs. mes anterior</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 space-y-4 p-5 rounded-xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Por cobrar</p>
                <p data-testid="por-cobrar" className="text-white font-bold text-xl">{money(stats.porCobrar)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Cartera vigente</p>
                <p data-testid="cartera-vigente" className="text-white font-bold text-xl">{money(stats.carteraVigente)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-slate-500 tracking-tighter">Eficiencia de Cobro</span>
                <span data-testid="eficiencia" className="text-emerald-400">{stats.eficiencia === null ? 'Sin datos' : `${stats.eficiencia}%`}</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.eficiencia ?? 0}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Cobrado sobre el total de cobrado + vencidos de los últimos 30 días.
              </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Cobrado últimos 6 meses</p>
          <div className="flex items-end gap-2 h-32">
            {stats.meses.map((mes, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end" title={money(mes.total)}>
                <div
                  className={`w-full rounded-t-md ${i === stats.meses.length - 1 ? 'bg-primary' : 'bg-primary/25'}`}
                  style={{ height: `${Math.max((mes.total / maxMes) * 100, 2)}%` }}
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">{mes.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Cartera por plataforma</p>
          {stats.plataformas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin clientes vigentes.</p>
          ) : (
            <ul className="space-y-3">
              {stats.plataformas.map(p => (
                <li key={p.plan} className="space-y-1">
                  <div className="flex justify-between gap-3 text-xs font-semibold">
                    <span className="truncate">{p.plan} <span className="text-muted-foreground font-medium">· {p.clientes}</span></span>
                    <span className="shrink-0">{money(p.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(p.total / maxPlan) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Últimos pagos</p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todavía no registraste pagos. Usá el botón “Registrar pago” de cada cliente cuando te abone.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map(p => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.cliente_nombre}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{day(p.fecha_pago)} · {p.medio}</p>
                  </div>
                  <span className="text-xs font-bold">{money(p.monto)}</span>
                  {onUndoPayment && (
                    <button
                      type="button"
                      onClick={() => onUndoPayment(p)}
                      title="Deshacer pago"
                      aria-label={`Deshacer pago de ${p.cliente_nombre}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Undo2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryCards;
