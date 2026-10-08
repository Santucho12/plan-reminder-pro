import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Client, Payment } from '@/types/client';

export interface DashboardStats {
  /** Todos los que tienen el plan vigente (incluye a los que vencen hoy y en los próximos días). */
  activos: number;
  vencenHoy: number;
  porVencer: number;
  /** Vencidos hace 1 a 30 días: los que todavía se cobran (mismo criterio que "Por cobrar" y que Mensajes). */
  vencidos: number;
  /** Vencidos hace más de 30 días: ya no se cuentan como deuda, se intentan recuperar. */
  enRecuperacion: number;
  /** Suma de lo que pagan los clientes con el plan vigente. */
  carteraVigente: number;
  /** Suma de los que vencen hoy o vencieron en los últimos 30 días: lo que hay para cobrar ahora. */
  porCobrar: number;
  cobradoMes: number;
  pagosMes: number;
  /** % contra el mes anterior, o null si el mes anterior no tuvo cobros. */
  variacion: number | null;
  /** % de lo cobrable que ya se cobró este mes, o null si no hay nada que medir. */
  eficiencia: number | null;
  /** Últimos 6 meses, del más viejo al actual. */
  meses: { label: string; total: number }[];
  /** Planes que más aportan a la cartera vigente. */
  plataformas: { plan: string; total: number; clientes: number }[];
}

export function computeStats(clients: Client[], payments: Payment[], now: Date = new Date()): DashboardStats {
  // Los dados de baja no cuentan como cartera ni como deuda
  const vigentes = clients.filter(c => c.seguimiento !== 'baja' && !Number.isNaN(Number(c.dias)));
  const sum = (list: Client[]) => list.reduce((acc, c) => acc + (Number(c.total) || 0), 0);

  const alDia = vigentes.filter(c => Number(c.dias) >= 0);
  const vencidos = vigentes.filter(c => Number(c.dias) < 0 && Number(c.dias) >= -30);
  const porCobrar = sum(vigentes.filter(c => Number(c.dias) === 0)) + sum(vencidos);

  const monthly = new Map<string, number>();
  let pagosMes = 0;
  const thisMonth = format(now, 'yyyy-MM');
  for (const p of payments) {
    const key = String(p.fecha_pago).slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + (Number(p.monto) || 0));
    if (key === thisMonth) pagosMes++;
  }

  const meses = [5, 4, 3, 2, 1, 0].map(back => {
    const date = subMonths(now, back);
    return { label: format(date, 'MMM', { locale: es }), total: monthly.get(format(date, 'yyyy-MM')) || 0 };
  });
  const cobradoMes = meses[5].total;
  const cobradoAnterior = meses[4].total;

  const byPlan = new Map<string, { plan: string; total: number; clientes: number }>();
  for (const c of alDia) {
    const plan = (c.plan || '').trim() || 'Sin plan';
    const entry = byPlan.get(plan.toLowerCase()) || { plan, total: 0, clientes: 0 };
    entry.total += Number(c.total) || 0;
    entry.clientes++;
    byPlan.set(plan.toLowerCase(), entry);
  }

  return {
    activos: alDia.length,
    vencenHoy: vigentes.filter(c => Number(c.dias) === 0).length,
    porVencer: vigentes.filter(c => Number(c.dias) >= 1 && Number(c.dias) <= 3).length,
    vencidos: vencidos.length,
    enRecuperacion: vigentes.filter(c => Number(c.dias) < -30).length,
    carteraVigente: sum(alDia),
    porCobrar,
    cobradoMes,
    pagosMes,
    variacion: cobradoAnterior > 0 ? Math.round(((cobradoMes - cobradoAnterior) / cobradoAnterior) * 100) : null,
    eficiencia: cobradoMes + porCobrar > 0 ? Math.round((cobradoMes / (cobradoMes + porCobrar)) * 100) : null,
    meses,
    plataformas: [...byPlan.values()].sort((a, b) => b.total - a.total).slice(0, 5),
  };
}
