import { LayoutDashboard, Users, MessageSquare, Settings, Upload, Zap, LogOut, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  hasClients?: boolean;
  onLogout?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
  { id: 'plataformas', label: 'Plataformas', icon: Layers },
  { id: 'config', label: 'Configuración', icon: Settings },
];

const AppSidebar = ({ activeView, onViewChange, hasClients, onLogout }: AppSidebarProps) => {
  const isMobile = useIsMobile();

  // En el teléfono: barra superior con la marca y navegación fija abajo, al alcance del pulgar
  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 inset-x-0 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] z-50 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="text-white fill-white" size={18} />
            </div>
            <h1 className="text-lg font-display font-extrabold tracking-tight leading-none">
              Fiesta<span className="text-primary">Cobra</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {!hasClients && (
              <button
                onClick={() => onViewChange('upload')}
                className="h-9 px-3 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
              >
                <Upload size={14} /> Cargar Excel
              </button>
            )}
            {onLogout && (
              <button onClick={onLogout} aria-label="Cerrar sesión" className="h-9 w-9 rounded-xl text-muted-foreground flex items-center justify-center">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>

        <nav className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border flex pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "flex-1 min-w-0 h-16 flex flex-col items-center justify-center gap-1 text-[9px] font-bold transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="truncate max-w-full px-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </>
    );
  }

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
            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap mt-1">
              Gestión de vencimientos
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
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all duration-300"
          >
            <LogOut size={20} />
            Cerrar sesión
          </button>
        )}

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
