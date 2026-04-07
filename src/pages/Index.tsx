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
import ClientDialog from '@/components/ClientDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { Client } from '@/types/client';
import { Download, Search, Filter, ArrowUpDown, Activity, Clock, UserPlus, FileSpreadsheet } from 'lucide-react';
import { fetchClients, triggerReminders, updateClient, deleteClient, createClient, exportClientsToExcel } from '@/lib/api';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<'total-asc' | 'total-desc'>('total-desc');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status') || urlParams.get('collection_status');

    if (status === 'approved' || status === 'success') {
      toast.success('¡Pago Procesado con Éxito!', {
        description: 'El cliente ya fue actualizado en el sistema.',
        duration: 8000,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadClients = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchClients(user.id);
      setClients(data.map(c => ({
        ...c,
        id: c.id,
        nombre: c.nombre,
        celular: c.celular,
        plan: c.plan || '',
        vencimiento: c.vencimiento,
        total: Number(c.total),
        estado: c.estado as Client['estado'],
        ultimoMensaje: c.ultimo_mensaje ? new Date(c.ultimo_mensaje) : undefined,
        dias: c.dias
      })));
    } catch (err) {
      console.error('Error loading clients:', err);
      toast.error('Error al cargar clientes');
    }
  }, [user]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Realtime listener
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${user.id}` }, () => {
        loadClients();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadClients]);

  const handleImport = async () => {
    await loadClients();
    setActiveView('dashboard');
    toast.success('Clientes importados correctamente');
  };

  const handleSendMessage = (client: Client) => {
    setSelectedClient(client);
  };

  const handleSaveClient = async (clientData: any) => {
    if (!user) return;
    try {
      if (clientToEdit) {
        await updateClient(clientToEdit.id, clientData);
        toast.success('Cliente actualizado correctamente');
      } else {
        await createClient(user.id, clientData);
        toast.success('Cliente creado correctamente');
      }
      loadClients();
    } catch (error) {
      toast.error('Error al guardar cliente');
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        await deleteClient(clientId);
        toast.success('Cliente eliminado');
        loadClients();
      } catch (error) {
        toast.error('Error al eliminar cliente');
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setClients([]);
  };

  const [wppStatus, setWppStatus] = useState<string>('disconnected');

  // Load wpp_status from user_configs with heartbeat check and subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const checkStatus = async () => {
      const { data } = await supabase
        .from('user_configs')
        .select('wpp_status, wpp_last_heartbeat')
        .eq('user_id', user.id)
        .single();
      
      if (!data) return;
      
      // If status says connected but heartbeat is stale (>90s), mark as disconnected
      if (data.wpp_status === 'connected' && data.wpp_last_heartbeat) {
        const lastBeat = new Date(data.wpp_last_heartbeat).getTime();
        const now = Date.now();
        if (now - lastBeat > 90000) {
          setWppStatus('disconnected');
          return;
        }
      }
      
      setWppStatus(data.wpp_status || 'disconnected');
    };
    
    checkStatus();
    // Re-check heartbeat every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    const channel = supabase
      .channel('wpp-status-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_configs', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newStatus = (payload.new as any)?.wpp_status;
        const heartbeat = (payload.new as any)?.wpp_last_heartbeat;
        
        if (newStatus === 'connected' && heartbeat) {
          const lastBeat = new Date(heartbeat).getTime();
          if (Date.now() - lastBeat > 90000) {
            setWppStatus('disconnected');
            return;
          }
        }
        
        if (newStatus) setWppStatus(newStatus);
      })
      .subscribe();
    return () => { 
      clearInterval(interval);
      supabase.removeChannel(channel); 
    };
  }, [user]);

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

  if (authLoading) return null;
  if (!user) return <AuthPage onAuth={() => {}} />;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        wppStatus={wppStatus}
        hasClients={clients.length > 0}
      />

      <main className="ml-[260px] p-10 min-h-screen relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px] -z-10" />

        <div className="max-w-7xl mx-auto">
          <header className="mb-10 animate-in-fade">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {activeView === 'dashboard' && (
                  <>
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Panel de Control</h2>
                    <p className="text-muted-foreground font-medium mt-2">
                      {clients.length > 0
                        ? `Gestionando ${clients.length} clientes en el sistema.`
                        : 'Cargá tu base de datos para comenzar la automatización.'}
                    </p>
                  </>
                )}
                {activeView === 'clientes' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-4xl font-display font-extrabold tracking-tight">Gestión de Clientes</h2>
                      <p className="text-muted-foreground font-medium mt-2">Buscá, filtrá y organizá tu base de datos.</p>
                    </div>
                    <button
                      onClick={() => {
                        setClientToEdit(null);
                        setIsDialogOpen(true);
                      }}
                      className="px-6 h-12 rounded-2xl bg-primary text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <UserPlus size={18} />
                      Nuevo Cliente
                    </button>
                  </div>
                )}
                {activeView === 'mensajes' && (
                  <>
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Envio de mensajes </h2>
                    <p className="text-muted-foreground font-medium mt-2">Gestioná el contenido de los recordatorios.</p>
                  </>
                )}
                {activeView === 'config' && (
                  <>
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Configuración de Sistema</h2>
                    <p className="text-muted-foreground font-medium mt-2">Acceso a la Api de Whatsapp y Mercado Pago</p>
                  </>
                )}
                {activeView === 'upload' && (
                  <>
                    <h2 className="text-4xl font-display font-extrabold tracking-tight">Importación masiva</h2>
                    <p className="text-muted-foreground font-medium mt-2">Subí tus archivos Excel para sincronizar clientes.</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeView === 'dashboard' && (
                <div className="space-y-8">
                  {clients.length > 0 ? (
                    <div className="space-y-10">
                      <section className="space-y-6">
                        <div className="flex items-center gap-3 px-1 text-slate-800">
                        </div>
                        <SummaryCards clients={clients} />
                      </section>

                      <section className="space-y-6">
                        <div className="flex items-center gap-3 px-1 text-slate-800">
                          <div className="w-1 h-6 bg-primary rounded-full" />
                          <h3 className="text-xl font-bold tracking-tight">Acciones Urgentes</h3>
                        </div>
                        <Tabs defaultValue="today" className="w-full">
                          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <TabsList className="bg-secondary/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/40 h-auto">
                              <TabsTrigger value="today" className="px-8 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <Activity className="w-4 h-4 mr-2" />
                                Vencen Hoy
                              </TabsTrigger>
                              <TabsTrigger value="soon" className="px-8 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <Clock className="w-4 h-4 mr-2" />
                                Próximos 3 días
                              </TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sincronizado en tiempo real
                            </div>
                          </div>

                          <TabsContent value="today" className="mt-0 outline-none animate-in-slide">
                            <ClientTable
                              clients={clients.filter(c => Number(c.dias) === 0)}
                              onSendMessage={handleSendMessage}
                              onEdit={(client) => {
                                setClientToEdit(client);
                                setIsDialogOpen(true);
                              }}
                              onDelete={handleDeleteClient}
                            />
                          </TabsContent>

                          <TabsContent value="soon" className="mt-0 outline-none animate-in-slide">
                            <ClientTable
                              clients={clients
                                .filter(c => {
                                  const d = Number(c.dias);
                                  return d >= 1 && d <= 3;
                                })
                                .sort((a, b) => Number(a.dias) - Number(b.dias))
                              }
                              onSendMessage={handleSendMessage}
                              onEdit={(client) => {
                                setClientToEdit(client);
                                setIsDialogOpen(true);
                              }}
                              onDelete={handleDeleteClient}
                            />
                          </TabsContent>
                        </Tabs>
                      </section>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-8 bg-card rounded-[3rem] border border-dashed border-slate-200 shadow-2xl shadow-slate-200/50 text-center animate-in zoom-in duration-700">
                      <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 rotate-3 shadow-inner">
                        <Download size={40} className="text-primary/40" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Comencemos la gestión.</h3>
                      <p className="text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed mb-10">
                        Tu panel de control está vacío. Sincronizá tu base de datos mediante un archivo Excel para activar las métricas y automatizaciones.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                        <button
                          onClick={() => setActiveView('config')}
                          className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                        >
                          Ir a centro de carga
                        </button>
                        <button
                          onClick={() => {
                            setClientToEdit(null);
                            setIsDialogOpen(true);
                          }}
                          className="flex-1 h-14 rounded-2xl bg-white border border-border text-slate-900 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-md"
                        >
                          Alta Manual
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeView === 'clientes' && (
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row gap-4 mb-8 bg-card border border-border p-5 rounded-3xl shadow-sm">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                      <Input
                        placeholder="Buscar por nombre..."
                        className="pl-12 h-14 rounded-2xl border-none bg-secondary/30 text-base font-medium focus-visible:ring-primary/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-secondary/30 border-none font-semibold">
                          <SelectValue placeholder="Plataforma" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="all">Plataforma</SelectItem>
                          {platforms.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-secondary/30 border-none font-semibold">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="all">Estado</SelectItem>
                          {statuses.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={sortConfig} onValueChange={(v: any) => setSortConfig(v)}>
                        <SelectTrigger className="w-[180px] h-14 rounded-2xl bg-secondary/30 border-none font-semibold">
                          <Search className="w-4 h-4 mr-2 text-muted-foreground/50" />
                          <SelectValue placeholder="Ordenar por monto" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="total-desc">Mayor monto</SelectItem>
                          <SelectItem value="total-asc">Menor monto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ClientTable
                    clients={filteredClients}
                    onSendMessage={handleSendMessage}
                    onEdit={(client) => {
                      setClientToEdit(client);
                      setIsDialogOpen(true);
                    }}
                    onDelete={handleDeleteClient}
                  />
                </div>
              )}

              {activeView === 'mensajes' && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <Tabs defaultValue="regular" className="w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-end gap-6 mb-10">
                      <TabsList className="bg-secondary/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/40 h-auto self-start">
                        <TabsTrigger value="regular" className="px-6 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">Recordatorios</TabsTrigger>
                        <TabsTrigger value="expired" className="px-6 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-lg">Vencidos</TabsTrigger>
                        <TabsTrigger value="lost" className="px-6 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg">Recuperación</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="regular" className="grid grid-cols-1 lg:grid-cols-3 gap-8 outline-none">
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card rounded-[2rem] border border-border/60 shadow-xl p-12 space-y-24 -mt-12">
                          <div className="space-y-8">
                            <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />Proximo a vencer (3 días)
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-border/40 font-medium leading-relaxed italic text-slate-700 dark:text-slate-300">
                              "Hola <span className="text-slate-900 dark:text-white font-bold">[Nombre]</span>, ¿cómo estás? Te recordamos que tu plan <span className="text-slate-900 dark:text-white font-bold">[Plan]</span> va a vencer en 3 días. El total es <span className="text-slate-900 dark:text-white font-bold">$[Total]</span>. ¡Que tengas un buen día! 💪"
                            </div>
                          </div>

                          <div className="space-y-6">
                            <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />Vencen hoy
                            </h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-border/40 font-medium leading-relaxed italic text-slate-700 dark:text-slate-300">
                              "Hola <span className="text-slate-900 dark:text-white font-bold">[Nombre]</span>, tu plan <span className="text-slate-900 dark:text-white font-bold">[Plan]</span> venció hoy. El total es <span className="text-slate-900 dark:text-white font-bold">$[Total]</span>. Podes pagar desde este link: <br />🔗 <span className="text-slate-900 dark:text-white font-bold underline">[Link Mercado Pago]</span> <br />¡Gracias!"
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Activity size={100} strokeWidth={1} />
                          </div>
                          <h4 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Envio de mensajes</h4>
                          <p className="text-slate-400 text-[11px] font-medium leading-relaxed mb-12">
                            Envío automático para clientes que hoy se les termina su plan o está próximo a vencer
                          </p>

                          <div className="space-y-3 mb-8">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                              <span>Usuarios alcanzados</span>
                              <span className="text-white">{clients.filter(c => Number(c.dias) === 0 || Number(c.dias) === 3).length} Clientes</span>
                            </div>
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-primary w-[75%] rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                            </div>
                          </div>

                          <button
                            disabled={wppStatus !== 'connected'}
                            onClick={async () => {
                              if (!user) return;
                              try {
                                const result = await triggerReminders(user.id, 'regular');
                                toast.success('Campaña Ejecutada', {
                                  description: `Se han despachado ${result?.expiry_sent + result?.reminders_sent} mensajes.`,
                                });
                                await loadClients();
                              } catch {
                                toast.error('Error al enviar campaña');
                              }
                            }}
                            className="w-full h-14 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                          >
                            {wppStatus !== 'connected' ? 'Bot Desconectado' : 'Iniciar Automatización'}
                          </button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="expired" className="space-y-8 outline-none animate-in-slide">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-card rounded-[2rem] border border-rose-100 shadow-xl p-8 space-y-6 text-slate-800">
                          <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500" /> Clientes vencidos (1-30 días)
                          </h4>
                          <div className="bg-rose-50/30 rounded-2xl p-8 border border-rose-500/10 font-medium leading-relaxed italic text-rose-950 border-l-rose-500 border-l-4 shadow-inner">
                            "Hola <span className="text-rose-600 font-bold">[Nombre]</span>, notamos que tu plan <span className="text-rose-600 font-bold">[Plan]</span> ya se encuentra vencido. El total para renovarlo es <span className="text-rose-600 font-bold">$[Total]</span>. Te mando el link de pago para reactivar tu servicio: <br />🔗 <span className="text-rose-600 font-bold underline">[Link Mercado Pago]</span>"
                          </div>
                        </div>

                        <div className="lg:col-span-1">
                          <div className="bg-white rounded-[2rem] border border-border shadow-lg p-8 h-full flex flex-col justify-between">
                            <div className="space-y-4">
                              <h5 className="text-lg font-bold leading-snug">Reactivando planes</h5>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">Notificá a los clientes que se les terminó el plan hace poco tiempo.</p>
                              <div className="pt-4">
                                <div className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-600 font-black text-[9px] uppercase tracking-tighter">
                                  {clients.filter(c => Number(c.dias) < 0 && Number(c.dias) >= -30).length}  --  Usuarios encontrados
                                </div>
                              </div>
                            </div>

                            <button
                              disabled={wppStatus !== 'connected'}
                              onClick={async () => {
                                if (!user) return;
                                try {
                                  const result = await triggerReminders(user.id, 'expired');
                                  toast.success('Cobranza Masiva Ejecutada', {
                                    description: `Se han notificado a ${result?.expired_sent || 0} deudores.`
                                  });
                                  await loadClients();
                                } catch {
                                  toast.error('Error al ejecutar proceso');
                                }
                              }}
                              className="w-full h-14 rounded-2xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600 disabled:active:scale-100"
                            >
                              {wppStatus !== 'connected' ? 'Bot Desconectado' : 'Iniciar automatización'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="lost" className="space-y-8 outline-none animate-in-slide">
                      <div className="bg-white rounded-[2rem] border border-border/60 shadow-xl p-12 flex flex-col space-y-8 items-start">
                        <h4 className="text-lg font-black uppercase tracking-widest text-blue-900 mb-4">RECUPERACIÓN DE CLIENTES</h4>
                        <p className="text-base text-slate-700 font-medium leading-relaxed mb-6">Intentá recuperar clientes que no renuevan hace más de 30 días.<br/>Tu base de datos tiene <span className="font-black text-blue-900">{clients.filter(c => Number(c.dias) < -30).length} clientes</span> que no renueva su plan hace bastante.</p>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-border/40 w-full text-slate-700 text-base font-medium">
                          "Hola <span className='font-bold text-black'>[Nombre]</span>, hace tiempo que no nos vemos. ¿Te gustaría volver? Tenemos una oferta especial para renovar tu plan <span className='font-bold text-black'>[Plan]</span>. El total es <span className='font-bold text-black'>$[Total]</span>. Podes pagar desde este link: <br />🔗 <span className='font-bold text-blue-900 underline'>[Link Mercado Pago]</span> <br />¡Gracias!"
                        </div>

                        <button
                          disabled={wppStatus !== 'connected'}
                          onClick={async () => {
                            if (!user) return;
                            try {
                              const result = await triggerReminders(user.id, 'lost');
                              toast.success('Campaña de Reconquista', {
                                description: `Mensajes enviados a ${result?.lost_sent || 0} ex-clientes.`,
                              });
                              await loadClients();
                            } catch {
                              toast.error('Error al iniciar campaña');
                            }
                          }}
                          className="w-full h-14 rounded-2xl bg-blue-900 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:shadow-[0_0_25px_rgba(30,58,138,0.4)] transition-all active:scale-95 mt-6 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                        >
                          {wppStatus !== 'connected' ? 'Bot Desconectado' : 'Iniciar automatización'}
                        </button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {activeView === 'config' && (
                <div className="animate-in-slide">
                  <ConfigView userId={user.id} onDataUpdate={loadClients} />
                </div>
              )}

              {activeView === 'upload' && (
                <div className="max-w-2xl mx-auto pt-10 animate-in-slide">
                  <ExcelUpload userId={user.id} onImport={handleImport} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedClient && (
          <MessagePreview client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDialogOpen && (
          <ClientDialog
            client={clientToEdit}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSaveClient}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;