import { LayoutDashboard, Users, MessageSquare, Settings, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  wppStatus?: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
  { id: 'config', label: 'Configuración', icon: Settings },
];

const AppSidebar = ({ activeView, onViewChange, wppStatus }: AppSidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] glass border-r bg-background flex flex-col z-50">
      <div className="p-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black tracking-tighter text-glow text-white">
            Fiesta<span className="text-primary">Cobra</span>
          </h1>
          <div className="flex items-center gap-2">
            {wppStatus === 'connected' ? (
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                <div className="relative w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" title="Online" />
              </div>
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" title="Offline" />
            )}
          </div>
        </div>
        <p className="text-[10px] uppercase font-extrabold tracking-[0.2em] text-muted-foreground/50">Cobros Inteligentes</p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-300",
                  "active:scale-[0.97]",
                  isActive
                    ? "text-primary bg-primary/10 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.12)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(isActive && "text-primary animate-in zoom-in-50")} />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_15px_hsl(var(--primary))]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-4">
        {wppStatus !== 'connected' && (
          <div className="px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-tighter mb-1">Pendiente</p>
            <p className="text-[11px] text-orange-200/70 leading-tight">Vinculá WhatsApp para activar el bot de cobros.</p>
          </div>
        )}
        
        <button
          onClick={() => onViewChange('upload')}
          className={cn(
            "group relative w-full flex items-center justify-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold transition-all",
            "bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)] hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.6)]",
            "hover:-translate-y-0.5 active:translate-y-0"
          )}
        >
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform" />
          <Upload size={18} strokeWidth={2.5} className="group-hover:bounce" />
          Cargar Excel
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
