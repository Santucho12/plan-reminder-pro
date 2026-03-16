import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import AppSidebar from '@/components/AppSidebar';
import SummaryCards from '@/components/SummaryCards';
import ClientTable from '@/components/ClientTable';
import ExcelUpload from '@/components/ExcelUpload';
import MessagePreview from '@/components/MessagePreview';
import AuthPage from '@/components/AuthPage';
import ConfigView from '@/components/ConfigView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Client } from '@/types/client';
import { fetchClients, triggerReminders } from '@/lib/api';
import { Download, Search, Filter, ArrowUpDown } from 'lucide-react';

const Index = () => {
  // ID de usuario fijo para modo "Sin Login"
  const fixedUserId = '00000000-0000-0000-0000-000000000000';
  const [user, setUser] = useState<any>({ id: fixedUserId });
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Estados para búsqueda y filtrado
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<'total-asc' | 'total-desc'>('total-desc');

  useEffect(() => {
    // Escuchar cambios en el estado de Mercado Pago (éxito)
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status') || urlParams.get('collection_status');

    if (status === 'approved' || status === 'success') {
      toast.success('¡Pago Procesado con Éxito!', {
        description: 'El cliente ya fue actualizado en el sistema.',
        duration: 8000,
      });
      // Limpiar URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Ya no necesitamos listeners de auth
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

  const [wppStatus, setWppStatus] = useState<string>('disconnected');

  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('user_configs')
        .select('wpp_status')
        .eq('user_id', user.id)
        .single();
      if (data) setWppStatus(data.wpp_status);
    };

    fetchStatus();

    const channel = supabase
      .channel('wpp-status-sidebar')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_configs', filter: `user_id=eq.${user.id}` },
        (payload) => setWppStatus(payload.new.wpp_status)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  // Lógica de filtrado y ordenamiento
  const platforms = Array.from(new Set(clients.map(c => c.plan).filter(Boolean)));
  const statuses = Array.from(new Set(clients.map(c => c.estado).filter(Boolean)));

  const filteredClients = clients
    .filter(client => {
      const matchesSearch = client.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlatform = platformFilter === 'all' || client.plan === platformFilter;
      const matchesStatus = statusFilter === 'all' || client.estado === statusFilter;
      return matchesSearch && matchesPlatform && matchesStatus;
    })
    .sort((a, b) => {
      if (sortConfig === 'total-asc') return a.total - b.total;
      if (sortConfig === 'total-desc') return b.total - a.total;
      return 0;
    });

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Decorations */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none opacity-50" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none opacity-50" />

      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        wppStatus={wppStatus}
      />

      <main className="ml-[260px] p-10 relative z-10 transition-all duration-500">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col gap-1 mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-primary rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                  {activeView}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                {activeView === 'dashboard' && 'Panel General'}
                {activeView === 'clientes' && 'Gestión de Clientes'}
                {activeView === 'mensajes' && 'Centro de Mensajes'}
                {activeView === 'config' && 'Configuración'}
                {activeView === 'upload' && 'Importar Datos'}
              </h1>
              <p className="text-muted-foreground font-medium text-sm">
                {activeView === 'dashboard' && (clients.length > 0 ? `Analizando ${clients.length} clientes en tiempo real.` : 'Iniciá tu operación cargando un archivo Excel.')}
                {activeView === 'clientes' && 'Filtra, busca y organiza tu base de datos con precisión.'}
                {activeView === 'mensajes' && 'Automatizá tus cobros con plantillas inteligentes de WhatsApp.'}
                {activeView === 'config' && 'Personalizá las integraciones de Mercado Pago y WhatsApp.'}
                {activeView === 'upload' && 'Sincronizá tu planilla de cálculo con nuestro motor de cobros.'}
              </p>
            </div>

            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {clients.length > 0 ? (
                  <>
                    <SummaryCards clients={clients} />

                    <Tabs defaultValue="today" className="w-full">
                      <div className="flex items-center justify-between mb-4">
                        <TabsList className="bg-white/5 border border-white/5 p-1 rounded-full">
                          <TabsTrigger value="today" className="px-8 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Vencen Hoy</TabsTrigger>
                          <TabsTrigger value="soon" className="px-8 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Próximos a Vencer</TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="today" className="mt-0 border-none p-0 shadow-none">
                        <ClientTable
                          clients={clients.filter(c => Number(c.dias) === 0)}
                          onSendMessage={handleSendMessage}
                        />
                      </TabsContent>

                      <TabsContent value="soon" className="mt-0 border-none p-0 shadow-none">
                        <ClientTable
                          clients={clients
                            .filter(c => {
                              const d = Number(c.dias);
                              return d >= 1 && d <= 3;
                            })
                            .sort((a, b) => Number(a.dias) - Number(b.dias))
                          }
                          onSendMessage={handleSendMessage}
                        />
                      </TabsContent>
                    </Tabs>
                  </>
                ) : (
                  <ExcelUpload onImport={handleImport} userId={user.id} />
                )}
              </div>
            )}

            {activeView === 'clientes' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      placeholder="Buscar por nombre..."
                      className="pl-10 glass border-white/10 rounded-xl"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                      <SelectTrigger className="w-[180px] glass border-white/10 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Filter size={16} className="text-muted-foreground" />
                          <SelectValue placeholder="Plataforma" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="all">Todas las plataformas</SelectItem>
                        {platforms.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px] glass border-white/10 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Filter size={16} className="text-muted-foreground" />
                          <SelectValue placeholder="Estado" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="all">Todos los estados</SelectItem>
                        {statuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={sortConfig} onValueChange={(v: any) => setSortConfig(v)}>
                      <SelectTrigger className="w-[180px] glass border-white/10 rounded-xl">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown size={16} className="text-muted-foreground" />
                          <SelectValue placeholder="Ordenar por total" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="glass">
                        <SelectItem value="total-desc">Monto (Mayor a Menor)</SelectItem>
                        <SelectItem value="total-asc">Monto (Menor a Mayor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ClientTable clients={filteredClients} onSendMessage={handleSendMessage} />
              </div>
            )}

            {activeView === 'mensajes' && (
              <div className="space-y-6">
                <Tabs defaultValue="regular" className="w-full">
                  <TabsList className="bg-white/5 border border-white/5 p-1 rounded-full mb-6">
                    <TabsTrigger value="regular" className="px-8 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Recordatorios Regulares</TabsTrigger>
                    <TabsTrigger value="expired" className="px-8 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Clientes Vencidos</TabsTrigger>
                    <TabsTrigger value="lost" className="px-8 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Recuperar Clientes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="regular" className="space-y-6">
                    <div className="glass-card rounded-2xl p-8 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Plantilla: Recordatorio Proactivo</h3>
                        <p className="text-xs text-muted-foreground">Enviado 3 días antes del vencimiento.</p>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-sm leading-relaxed text-white/80 italic">
                        "Hola [Nombre], como estas? te recordamos que tu plan <strong>[Plan]</strong> va a vencer en 3 días. El total es <strong>$[Total]</strong>. Que tengas un buen día! 💪"
                      </div>

                      <div className="space-y-2 pt-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Plantilla: Alerta de Vencimiento</h3>
                        <p className="text-xs text-muted-foreground">Enviado el día que expira el plan.</p>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-sm leading-relaxed text-white/80 italic">
                        "Hola [Nombre], tu plan <strong>[Plan]</strong> venció hoy. El total es <strong>$[Total]</strong>. Te mando el link de pago: 🔗 [Link Mercado Pago]. Gracias!"
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-6 glass-card border-primary/20 bg-primary/5 rounded-2xl">
                      <div className="space-y-1">
                        <h4 className="font-bold text-white">Ejecutar Campaña Regular</h4>
                        <p className="text-xs text-muted-foreground">Impacta a {clients.filter(c => Number(c.dias) >= 0 && Number(c.dias) <= 3).length} clientes activos.</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const result = await triggerReminders(user.id, 'regular');
                            toast.success('Recordatorios Regulares Enviados', {
                              description: `Se enviaron ${result?.expiry_sent || 0} de hoy y ${result?.reminders_sent || 0} próximos.`,
                            });
                            await loadClients();
                          } catch {
                            toast.error('Error al enviar recordatorios');
                          }
                        }}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_-5px_hsl(var(--primary))] hover:scale-105 active:scale-95 transition-all"
                      >
                        Enviar Ahora
                      </button>
                    </div>
                  </TabsContent>

                  <TabsContent value="expired" className="space-y-6">
                    <div className="glass-card rounded-2xl p-8 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-red-400">Plantilla: Cobranza Crítica</h3>
                        <p className="text-xs text-muted-foreground">Clientes con 1 a 30 días de atraso.</p>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-sm leading-relaxed text-red-100/80 italic">
                        "Hola [Nombre], notamos que tu plan <strong>[Plan]</strong> ya se encuentra vencido. El total para renovarlo es <strong>$[Total]</strong>. Te mando el link de pago: 🔗 [Link Mercado Pago]. Gracias!"
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-6 glass-card border-red-500/20 bg-red-500/5 rounded-2xl">
                      <div className="space-y-1">
                        <h4 className="font-bold text-white">Impactar Vencidos</h4>
                        <p className="text-xs text-muted-foreground">{clients.filter(c => Number(c.dias) < 0 && Number(c.dias) >= -30).length} clientes detectados.</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const result = await triggerReminders(user.id, 'expired');
                            toast.success('Campaña de Cobranza Ejecutada', {
                              description: `Se enviaron mensajes a ${result?.expired_sent || 0} clientes vencidos.`,
                            });
                            await loadClients();
                          } catch {
                            toast.error('Error al ejecutar campaña');
                          }
                        }}
                        className="px-8 py-3 rounded-xl bg-red-500 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 transition-all"
                      >
                        Iniciar Cobro Masivo
                      </button>
                    </div>
                  </TabsContent>

                  <TabsContent value="lost" className="space-y-6">
                    <div className="glass-card rounded-2xl p-8 space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-orange-400">Plantilla: Recuperación de Clientes</h3>
                        <p className="text-xs text-muted-foreground">Clientes inactivos hace más de 30 días.</p>
                      </div>
                      <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-6 text-sm leading-relaxed text-orange-100/80 italic">
                        "Hola [Nombre], notamos que hace un tiempo no estas usando tu plan <strong>[Plan]</strong> . ¿Te gustaría renovarlo? El total es <strong>$[Total]</strong>. Te mando el link de pago: 🔗 [Link Mercado Pago]"
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-6 glass-card border-orange-500/20 bg-orange-500/5 rounded-2xl">
                      <div className="space-y-1">
                        <h4 className="font-bold text-white">Campaña de Reactivación</h4>
                        <p className="text-xs text-muted-foreground">{clients.filter(c => Number(c.dias) < -30).length} clientes perdidos identificados.</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const result = await triggerReminders(user.id, 'lost');
                            toast.success('Campaña de Recuperación Ejecutada', {
                              description: `Se enviaron mensajes a ${result?.lost_sent || 0} clientes perdidos.`,
                            });
                            await loadClients();
                          } catch {
                            toast.error('Error al ejecutar campaña');
                          }
                        }}
                        className="px-8 py-3 rounded-xl bg-orange-500 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95 transition-all"
                      >
                        Recuperar Ahora
                      </button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {activeView === 'config' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ConfigView userId={user.id} />
              </div>
            )}

            {activeView === 'upload' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ExcelUpload onImport={handleImport} userId={user.id} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
