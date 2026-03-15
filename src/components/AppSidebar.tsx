import { LayoutDashboard, Users, MessageSquare, Settings, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
  { id: 'config', label: 'Configuración', icon: Settings },
];

const AppSidebar = ({ activeView, onViewChange }: AppSidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] border-r border-border bg-card flex flex-col z-50">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tighter text-foreground">
          Vence<span className="text-primary">Flow</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Cobros en piloto automático</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                "active:scale-[0.98]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon size={18} strokeWidth={1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => onViewChange('upload')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
            activeView === 'upload' && "ring-2 ring-ring ring-offset-2"
          )}
        >
          <Upload size={18} strokeWidth={1.5} />
          Cargar Excel
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
