import { LayoutDashboard, Users, MessageSquare, Settings, Upload, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  wppStatus?: string;
  hasClients?: boolean;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
  { id: 'config', label: 'Configuración', icon: Settings },
];

const AppSidebar = ({ activeView, onViewChange, wppStatus, hasClients }: AppSidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] border-r border-border bg-card flex flex-col z-50">
      {/* Brand Header */}
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-extrabold tracking-tight leading-none">
              Fiesta<span className="text-primary">Cobra</span>
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Cobrando en automático
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "relative group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300",
                isActive
                  ? "text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="relative z-10">{item.label}</span>

              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-primary/10 rounded-2xl -z-0"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Status */}
      <div className="p-4 space-y-4">
        {/* WhatsApp Status Indicator */}
        <div
          onClick={() => onViewChange('config')}
          className="mx-2 p-4 rounded-2xl bg-secondary/30 border border-border group hover:bg-secondary transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={`relative w-4 h-4 rounded-full flex items-center justify-center`}>
              {wppStatus === 'connected' ? (
                <>
                  <span className="absolute animate-ping w-full h-full rounded-full bg-emerald-400 opacity-75"></span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                </>
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5 leading-none">WhatsApp</p>
              <p className="text-xs font-semibold leading-none">
                {wppStatus === 'connected' ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
            <Settings size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Action Button - Only show if no clients */}
        {!hasClients && (
          <button
            onClick={() => onViewChange('upload')}
            className={cn(
              "w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-xl transition-all duration-300",
              "bg-primary text-white shadow-primary/30",
              "hover:bg-primary/90 hover:-translate-y-1 hover:shadow-primary/40 active:translate-y-0",
              activeView === 'upload' && "ring-4 ring-primary/20"
            )}
          >
            <Upload size={18} strokeWidth={2.5} />
            Cargar Excel
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
