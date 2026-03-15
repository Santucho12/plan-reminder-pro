import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import AppSidebar from '@/components/AppSidebar';
import SummaryCards from '@/components/SummaryCards';
import ClientTable from '@/components/ClientTable';
import ExcelUpload from '@/components/ExcelUpload';
import MessagePreview from '@/components/MessagePreview';
import AuthPage from '@/components/AuthPage';
import { Client } from '@/types/client';
import { fetchClients, triggerReminders } from '@/lib/api';
import { LogOut } from 'lucide-react';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadClients = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchClients(user.id);
      setClients(data.map(c => ({
        ...c,
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido || '',
        celular: c.celular,
        plan: c.plan || '',
        vencimiento: new Date(c.vencimiento),
        total: Number(c.total),
        estado: c.estado as Client['estado'],
        ultimoMensaje: c.ultimo_mensaje ? new Date(c.ultimo_mensaje) : undefined,
      })));
    } catch (err) {
      console.error('Error loading clients:', err);
      toast.error('Error al cargar clientes');
    }
  }, [user]);

  useEffect(() => {
    if (user) loadClients();
  }, [user, loadClients]);

  const handleImport = async () => {
    await loadClients();
    setActiveView('dashboard');
    toast.success('Clientes importados correctamente');
  };

  const handleSendMessage = (client: Client) => {
    setSelectedClient(client);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setClients([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />

      <main className="ml-[240px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            {activeView === 'dashboard' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tighter">Dashboard</h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {clients.length > 0
                    ? `Tenés ${clients.length} clientes cargados.`
                    : 'Cargá un Excel para comenzar a gestionar tus cobros.'}
                </p>
              </>
            )}
            {activeView === 'clientes' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tighter">Clientes</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Todos tus clientes en un solo lugar.</p>
              </>
            )}
            {activeView === 'mensajes' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tighter">Mensajes</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Templates de mensajes de WhatsApp.</p>
              </>
            )}
            {activeView === 'config' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tighter">Configuración</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Ajustá las integraciones.</p>
              </>
            )}
            {activeView === 'upload' && (
              <>
                <h2 className="text-2xl font-semibold tracking-tighter">Cargar Excel</h2>
                <p className="text-muted-foreground text-sm mt-0.5">Importá tus clientes desde un archivo.</p>
              </>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Salir
          </button>
        </div>

        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {clients.length > 0 ? (
              <>
                <SummaryCards clients={clients} />
                <ClientTable clients={clients} onSendMessage={handleSendMessage} />
              </>
            ) : (
              <ExcelUpload onImport={handleImport} userId={user.id} />
            )}
          </div>
        )}

        {activeView === 'clientes' && (
          <ClientTable clients={clients} onSendMessage={handleSendMessage} />
        )}

        {activeView === 'mensajes' && (
          <div className="space-y-6">
            <div className="bg-card rounded-lg shadow-card border border-border p-6 space-y-4">
              <h3 className="text-sm font-semibold">Template: Recordatorio (3 días antes)</h3>
              <div className="bg-[hsl(120_30%_95%)] rounded-lg rounded-tl-none p-4 text-sm leading-relaxed">
                Hola [Nombre], como estas? te recordamos que tu plan <strong>[Plan]</strong> va a vencer en 3 días. El total es <strong>$[Total]</strong>.
                <br /><br />Que tengas un buen día! 💪
              </div>

              <h3 className="text-sm font-semibold mt-6">Template: Vencimiento (día del vencimiento)</h3>
              <div className="bg-[hsl(120_30%_95%)] rounded-lg rounded-tl-none p-4 text-sm leading-relaxed">
                Hola [Nombre], tu plan <strong>[Plan]</strong> venció hoy. El total es <strong>$[Total]</strong>.
                <br /><br />Te mando el link de pago: 🔗 [Link Mercado Pago]
                <br /><br />Gracias!
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  const result = await triggerReminders();
                  toast.success(`Recordatorios: ${result?.reminders_sent || 0} enviados, Vencimientos: ${result?.expiry_sent || 0}`);
                  await loadClients();
                } catch {
                  toast.error('Error al enviar recordatorios');
                }
              }}
              className="px-5 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Ejecutar recordatorios ahora
            </button>
          </div>
        )}

        {activeView === 'config' && (
          <div className="grid gap-4 max-w-lg">
            <div className="bg-card rounded-lg shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold mb-1">WhatsApp</h3>
              <p className="text-xs text-muted-foreground mb-3">Conectá tu cuenta para enviar mensajes automáticos.</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-pending text-status-pending-text">
                No conectado
              </span>
            </div>
            <div className="bg-card rounded-lg shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold mb-1">Mercado Pago</h3>
              <p className="text-xs text-muted-foreground mb-3">Conectá tu cuenta para generar links de pago.</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-pending text-status-pending-text">
                No conectado
              </span>
            </div>
          </div>
        )}

        {activeView === 'upload' && (
          <ExcelUpload onImport={handleImport} userId={user.id} />
        )}
      </main>

      <AnimatePresence>
        {selectedClient && (
          <MessagePreview client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
