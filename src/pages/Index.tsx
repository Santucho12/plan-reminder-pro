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
import MessagesView from '@/components/MessagesView';
import AuthPage from '@/components/AuthPage';
import ConfigView from '@/components/ConfigView';
import ClientDialog from '@/components/ClientDialog';
import ClientSheet from '@/components/ClientSheet';
import PaymentDialog, { PaymentInput } from '@/components/PaymentDialog';
import PlansView from '@/components/PlansView';
import SendQueue from '@/components/SendQueue';
import ModuleHelp, { HelpModule } from '@/components/ModuleHelp';
import { UnsavedChangesProvider, useConfirmLeave } from '@/hooks/useUnsavedChanges';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Client, CobroData, Payment, Plan } from '@/types/client';
import { ArrowUpDown, Download, Search, Activity, Clock, UserPlus, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { scrollToTop } from '@/lib/smoothScroll';
import {
  addClientEvent,
  createClient,
  deleteClient,
  exportClientsToExcel,
  fetchClients,
  fetchPayments,
  fetchSettingsJson,
  fetchWorkspaceId,
  isMissingSchema,
  SCHEMA_PENDING_MESSAGE,
  registerPayment,
  saveSettingsJson,
  undoPayment,
  updateClient,
  updateClientsPlan,
  updateClientsTotal,
} from '@/lib/api';
import {
  AppSettings,
  TEMPLATE_LABELS,
  TemplateKey,
  getSegment,
  isCobroEmpty,
  parseSettings,
  serializeSettings,
} from '@/lib/whatsapp';

const IndexPage = () => {
  const confirmLeave = useConfirmLeave();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  /** Falta aplicar la migración de pagos / ficha en la base. */
  const [schemaPending, setSchemaPending] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<'total-asc' | 'total-desc'>('total-desc');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [sheetClientId, setSheetClientId] = useState<string | null>(null);
  const [increaseQueue, setIncreaseQueue] = useState<Client[] | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => parseSettings(null));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  /** Workspace de datos (compartido entre el admin y el usuario configurable). */
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Supabase vuelve a avisar SIGNED_IN cada vez que se regresa a la pestaña (por ejemplo, después de
    // abrir WhatsApp). Si es el mismo usuario se conserva el objeto: si no, se recargaría toda la app
    // y se cerrarían la cola de envío y las ventanas abiertas.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser(prev => (prev && next && prev.id === next.id && prev.email === next.email ? prev : next));
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    setWorkspaceId(null);
    setNoAccess(false);
    if (!userId) return;
    let cancelled = false;
    fetchWorkspaceId(userId)
      .then(id => {
        if (cancelled) return;
        if (id) setWorkspaceId(id);
        else setNoAccess(true);
      })
      .catch(err => {
        console.error('Error loading workspace:', err);
        if (!cancelled) toast.error('No se pudo cargar tu acceso');
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Cada pantalla arranca desde arriba (si no, al cambiar de módulo queda el scroll de la anterior)
  useEffect(() => {
    scrollToTop();
  }, [activeView]);

  const loadClients = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await fetchClients(workspaceId);
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
        dias: c.dias,
        nota_plataforma: c.nota_plataforma,
        nota_precio: c.nota_precio
      })));
    } catch (err) {
      console.error('Error loading clients:', err);
      toast.error('Error al cargar clientes');
    }
  }, [workspaceId]);

  const loadPayments = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setPayments(await fetchPayments(workspaceId));
      setSchemaPending(false);
    } catch (err) {
      // Sin la tabla de pagos la app sigue funcionando; solo se avisa que falta la migración
      if (isMissingSchema(err)) setSchemaPending(true);
      else console.error('Error loading payments:', err);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadClients();
    loadPayments();
  }, [loadClients, loadPayments]);

  // Plantillas, datos de cobro y catálogo guardados por el usuario
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetchSettingsJson(workspaceId)
      .then(raw => {
        if (cancelled) return;
        setSettings(parseSettings(raw));
        setSettingsLoaded(true);
      })
      .catch(err => console.error('Error loading settings:', err));
    return () => { cancelled = true; };
  }, [workspaceId]);

  const saveSettings = async (next: AppSettings) => {
    if (!workspaceId) return;
    await saveSettingsJson(workspaceId, serializeSettings(next));
    setSettings(next);
  };

  const handleSaveTemplate = async (key: TemplateKey, text: string) => {
    try {
      await saveSettings({ ...settings, templates: { ...settings.templates, [key]: text } });
      toast.success('Mensaje guardado');
    } catch (error) {
      toast.error('No se pudo guardar el mensaje');
      throw error;
    }
  };

  const handleSaveCobro = async (cobro: CobroData) => {
    try {
      await saveSettings({ ...settings, cobro });
      toast.success('Datos de cobro guardados');
    } catch (error) {
      toast.error('No se pudieron guardar los datos de cobro');
      throw error;
    }
  };

  /** Guarda el catálogo y, si se pide, lleva el precio de cada plan a sus clientes. Devuelve los clientes modificados. */
  /**
   * Guarda el catálogo. Primero pasa a los clientes de los planes renombrados al nombre nuevo y,
   * si se pide, lleva el precio de cada plan a sus clientes. Devuelve los clientes con precio cambiado.
   */
  const handleSavePlans = async (
    planes: Plan[],
    options: { applyToClients: boolean; skipNoted: boolean; renames?: { from: string; to: string }[] },
  ) => {
    const norm = (value: string) => value.trim().toLowerCase();
    const affected: Client[] = [];
    let renamed = false;
    try {
      let current = clients;
      for (const { from, to } of options.renames ?? []) {
        const targets = current.filter(c => norm(c.plan) === norm(from));
        if (targets.length === 0) continue;
        await updateClientsPlan(targets.map(c => c.id), to);
        renamed = true;
        const ids = new Set(targets.map(c => c.id));
        current = current.map(c => (ids.has(c.id) ? { ...c, plan: to } : c));
      }
      if (options.applyToClients) {
        for (const plan of planes) {
          const targets = current.filter(c =>
            norm(c.plan) === norm(plan.nombre) && c.total !== plan.precio && !(options.skipNoted && c.nota_precio)
          );
          if (targets.length === 0) continue;
          await updateClientsTotal(targets.map(c => c.id), plan.precio);
          affected.push(...targets.map(c => ({ ...c, total: plan.precio })));
        }
      }
      await saveSettings({ ...settings, planes });
      if (affected.length > 0 || renamed) await loadClients();
      toast.success(options.applyToClients ? 'Precios actualizados' : 'Catálogo guardado');
      return affected;
    } catch (error) {
      toast.error('No se pudieron guardar los precios');
      if (affected.length > 0 || renamed) loadClients();
      throw error;
    }
  };

  // Realtime listener
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${workspaceId}` }, () => {
        loadClients();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, loadClients]);

  const handleImport = async () => {
    await loadClients();
    setActiveView('dashboard');
    toast.success('Clientes importados correctamente');
  };

  const handleSendMessage = (client: Client) => {
    setSelectedClient(client);
  };

  const handleMessageSent = async (client: Client, templateKey?: TemplateKey) => {
    const now = new Date();
    setClients(prev => prev.map(c => (c.id === client.id ? { ...c, ultimoMensaje: now } : c)));
    try {
      await updateClient(client.id, { ultimo_mensaje: now.toISOString() });
    } catch {
      toast.error('No se pudo registrar el envío');
    }
    // El historial de la ficha es un extra: si falla no interrumpe el envío
    if (workspaceId) {
      const label = TEMPLATE_LABELS[templateKey ?? getSegment(client) ?? 'soon'];
      addClientEvent(workspaceId, client.id, 'mensaje', `Plantilla: ${label}`).catch(() => {});
    }
  };

  const handleRegisterPayment = async (input: PaymentInput) => {
    if (!user || !paymentClient) return;
    try {
      await registerPayment(workspaceId, paymentClient, input);
      toast.success('Pago registrado');
      await Promise.all([loadClients(), loadPayments()]);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo registrar el pago');
      throw error;
    }
  };

  const handleUndoPayment = async (payment: Payment) => {
    if (!window.confirm(`¿Deshacer el pago de ${payment.cliente_nombre}? El cliente vuelve al vencimiento anterior.`)) return;
    try {
      const { vencimientoRevertido } = await undoPayment(payment);
      if (vencimientoRevertido || !payment.client_id) {
        toast.success('Pago deshecho');
      } else {
        toast.warning(`Se borró el pago, pero el vencimiento de ${payment.cliente_nombre} no se tocó: tuvo una renovación posterior o ya no está cargado.`);
      }
      await Promise.all([loadClients(), loadPayments()]);
    } catch {
      toast.error('No se pudo deshacer el pago');
    }
  };

  /** Da de baja (deja de aparecer en Mensajes y en el dashboard) o reactiva al cliente. */
  const handleToggleBaja = async (client: Client) => {
    if (!workspaceId) return;
    const seguimiento = client.seguimiento === 'baja' ? null : 'baja';
    try {
      await updateClient(client.id, { seguimiento });
    } catch (error) {
      throw isMissingSchema(error) ? new Error(SCHEMA_PENDING_MESSAGE) : error;
    }
    setClients(prev => prev.map(c => (c.id === client.id ? { ...c, seguimiento } : c)));
    toast.success(seguimiento ? `${client.nombre} quedó dado de baja` : `${client.nombre} fue reactivado`);
    addClientEvent(workspaceId, client.id, 'estado', seguimiento ? 'Dado de baja' : 'Reactivado').catch(() => {});
  };

  const handleSaveClient = async (clientData: any) => {
    if (!workspaceId) return;
    try {
      if (clientToEdit) {
        await updateClient(clientToEdit.id, clientData);
        toast.success('Cliente actualizado correctamente');
      } else {
        await createClient(workspaceId, clientData);
        toast.success('Cliente creado correctamente');
      }
      loadClients();
    } catch (error) {
      toast.error('Error al guardar cliente');
      // Se propaga para que el formulario no se cierre y no se pierda lo cargado
      throw error;
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
    setPayments([]);
    setSettings(parseSettings(null));
    setSettingsLoaded(false);
    setSheetClientId(null);
    setActiveView('dashboard');
  };

  const openEdit = (client: Client | null) => {
    setClientToEdit(client);
    setIsDialogOpen(true);
  };

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

  const sheetClient = sheetClientId ? clients.find(c => c.id === sheetClientId) ?? null : null;

  if (authLoading) return null;
  if (!user) return <AuthPage onAuth={() => {}} />;
  if (noAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-bold">Tu usuario no tiene acceso</h2>
        <p className="text-sm text-muted-foreground">Entrá con el usuario administrador o con el usuario configurado.</p>
        <button type="button" onClick={handleLogout} className="px-5 h-11 rounded-xl bg-primary text-white text-sm font-bold">
          Cerrar sesión
        </button>
      </div>
    );
  }
  if (!workspaceId) return null;

  const tableActions = {
    onSendMessage: handleSendMessage,
    onEdit: openEdit,
    onDelete: handleDeleteClient,
    onRegisterPayment: setPaymentClient,
    onOpen: (client: Client) => setSheetClientId(client.id),
  };

  const headingClass = 'text-2xl md:text-4xl font-display font-extrabold tracking-tight';
  const subtitleClass = 'text-sm md:text-base text-muted-foreground font-medium mt-1 md:mt-2';

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        activeView={activeView}
        onViewChange={(view) => { if (view !== activeView) confirmLeave(() => setActiveView(view)); }}
        hasClients={clients.length > 0}
        onLogout={() => confirmLeave(handleLogout)}
      />

      <main className="md:ml-[260px] px-4 pt-20 pb-28 md:p-10 min-h-screen relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] -z-10" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px] -z-10" />

        <div className="max-w-7xl mx-auto">
          <header className="mb-6 md:mb-10 animate-in-fade flex items-start gap-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                {activeView === 'dashboard' && (
                  <>
                    <h2 className={headingClass}>Panel de Control</h2>
                    <p className={subtitleClass}>
                      {clients.length > 0
                        ? `Gestionando ${clients.length} clientes en el sistema.`
                        : 'Cargá tu base de datos para comenzar a gestionar vencimientos.'}
                    </p>
                  </>
                )}
                {activeView === 'clientes' && (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h2 className={headingClass}>Gestión de Clientes</h2>
                      <p className={subtitleClass}>Buscá, filtrá y organizá tu base de datos.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => exportClientsToExcel(clients)}
                        className="flex-1 lg:flex-none px-4 md:px-6 h-11 md:h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm md:uppercase md:tracking-widest whitespace-nowrap shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3"
                      >
                        <FileSpreadsheet size={18} />
                        Exportar Excel
                      </button>
                      <button
                        onClick={() => openEdit(null)}
                        className="flex-1 lg:flex-none px-4 md:px-6 h-11 md:h-12 rounded-2xl bg-primary text-white font-bold text-sm md:uppercase md:tracking-widest whitespace-nowrap shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3"
                      >
                        <UserPlus size={18} />
                        Nuevo Cliente
                      </button>
                    </div>
                  </div>
                )}
                {activeView === 'mensajes' && (
                  <>
                    <h2 className={headingClass}>Mensajes</h2>
                    <p className={subtitleClass}>Abrí el chat de WhatsApp de cada cliente con el mensaje ya armado.</p>
                  </>
                )}
                {activeView === 'plataformas' && (
                  <>
                    <h2 className={headingClass}>Plataformas</h2>
                    <p className={subtitleClass}>Catálogo de planes, precios y aumentos.</p>
                  </>
                )}
                {activeView === 'config' && (
                  <>
                    <h2 className={headingClass}>Configuración de Sistema</h2>
                    <p className={subtitleClass}>Datos de cobro, accesos y carga de la base de datos.</p>
                  </>
                )}
                {activeView === 'upload' && (
                  <>
                    <h2 className={headingClass}>Importación masiva</h2>
                    <p className={subtitleClass}>Subí tus archivos Excel para sincronizar clientes.</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            {/* Ayuda de la pantalla (la importación usa la de Configuración) */}
            <ModuleHelp key={activeView} module={activeView === 'upload' ? 'config' : (activeView as HelpModule)} />
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {settingsLoaded && isCobroEmpty(settings.cobro) && (activeView === 'dashboard' || activeView === 'mensajes') && (
                <div role="alert" className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <AlertTriangle size={18} className="shrink-0" />
                  <p className="text-sm flex-1">
                    <span className="font-bold">Faltan tus datos de cobro.</span>{' '}
                    Cargá tu alias o CBU para que los mensajes le digan al cliente cómo pagarte.
                  </p>
                  <button
                    type="button"
                    onClick={() => confirmLeave(() => setActiveView('config'))}
                    className="px-4 h-9 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
                  >
                    Cargar datos de cobro
                  </button>
                </div>
              )}

              {activeView === 'dashboard' && (
                <div className="space-y-8">
                  {schemaPending && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <p className="text-sm">
                        <span className="font-bold">Falta actualizar la base de datos.</span>{' '}
                        Para registrar pagos y usar la ficha del cliente hay que aplicar la migración{' '}
                        <code className="font-mono text-xs">20261007120000_payments_and_client_events.sql</code> en Supabase.
                      </p>
                    </div>
                  )}
                  {clients.length > 0 ? (
                    <div className="space-y-10">
                      <section className="space-y-6">
                        <SummaryCards clients={clients} payments={payments} onUndoPayment={handleUndoPayment} />
                      </section>

                      <section className="space-y-6">
                        <div className="flex items-center gap-3 px-1 text-slate-800">
                          <div className="w-1 h-6 bg-primary rounded-full" />
                          <h3 className="text-xl font-bold tracking-tight">Acciones Urgentes</h3>
                        </div>
                        <Tabs defaultValue="today" className="w-full">
                          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <TabsList className="bg-secondary/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/40 h-auto w-full md:w-auto">
                              <TabsTrigger value="today" className="flex-1 md:flex-none px-3 md:px-8 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <Activity className="w-4 h-4 mr-2" />
                                Vencen hoy
                              </TabsTrigger>
                              <TabsTrigger value="soon" className="flex-1 md:flex-none px-3 md:px-8 py-2.5 rounded-xl font-bold transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg">
                                <Clock className="w-4 h-4 mr-2" />
                                Próximos 3 días
                              </TabsTrigger>
                            </TabsList>

                            <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sincronizado en tiempo real
                            </div>
                          </div>

                          <TabsContent value="today" className="mt-0 outline-none animate-in-slide">
                            <ClientTable clients={clients.filter(c => Number(c.dias) === 0)} {...tableActions} />
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
                              {...tableActions}
                            />
                          </TabsContent>
                        </Tabs>
                      </section>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-14 md:py-20 px-6 md:px-8 bg-card rounded-[2rem] md:rounded-[3rem] border border-dashed border-slate-200 shadow-2xl shadow-slate-200/50 text-center animate-in zoom-in duration-700">
                      <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 rotate-3 shadow-inner">
                        <Download size={40} className="text-primary/40" />
                      </div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">Comencemos la gestión.</h3>
                      <p className="text-muted-foreground font-medium max-w-sm mx-auto leading-relaxed mb-10">
                        Tu panel de control está vacío. Sincronizá tu base de datos mediante un archivo Excel para activar las métricas y los recordatorios.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                        <button
                          onClick={() => confirmLeave(() => setActiveView('config'))}
                          className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl"
                        >
                          Ir a centro de carga
                        </button>
                        <button
                          onClick={() => openEdit(null)}
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
                  <div className="flex flex-col lg:flex-row gap-3 md:gap-4 mb-4 md:mb-8 bg-card border border-border p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-sm">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                      <Input
                        placeholder="Buscar por nombre..."
                        className="pl-12 h-12 md:h-14 rounded-xl md:rounded-2xl border-none bg-secondary/30 text-base font-medium focus-visible:ring-primary/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-[1.3fr_1fr_1fr] sm:flex sm:flex-wrap gap-2 md:gap-3">
                      <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] h-11 md:h-14 px-3 md:px-4 rounded-xl md:rounded-2xl bg-secondary/30 border-none text-xs md:text-sm font-semibold [&>span]:truncate">
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
                        <SelectTrigger className="w-full sm:w-[180px] h-11 md:h-14 px-3 md:px-4 rounded-xl md:rounded-2xl bg-secondary/30 border-none text-xs md:text-sm font-semibold [&>span]:truncate">
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
                        <SelectTrigger className="w-full sm:w-[180px] h-11 md:h-14 px-3 md:px-4 rounded-xl md:rounded-2xl bg-secondary/30 border-none text-xs md:text-sm font-semibold [&>span]:truncate">
                          <ArrowUpDown className="hidden min-[380px]:block w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0 text-muted-foreground/60" />
                          {/* En el celular no entra "Mayor monto": se muestra abreviado */}
                          <div className="sm:hidden truncate">{sortConfig === 'total-desc' ? 'Mayor $' : 'Menor $'}</div>
                          <div className="hidden sm:block truncate"><SelectValue placeholder="Ordenar por monto" /></div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="total-desc">Mayor monto</SelectItem>
                          <SelectItem value="total-asc">Menor monto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ClientTable clients={filteredClients} {...tableActions} />
                </div>
              )}

              {activeView === 'mensajes' && (
                <MessagesView
                  clients={clients}
                  templates={settings.templates}
                  cobro={settings.cobro}
                  onSaveTemplate={handleSaveTemplate}
                  onSent={handleMessageSent}
                  onRegisterPayment={setPaymentClient}
                  onOpenClient={(client) => setSheetClientId(client.id)}
                />
              )}

              {activeView === 'plataformas' && (
                <PlansView
                  clients={clients}
                  plans={settings.planes}
                  onSave={handleSavePlans}
                  onNotify={setIncreaseQueue}
                />
              )}

              {activeView === 'config' && (
                <div className="animate-in-slide">
                  <ConfigView userId={workspaceId} onDataUpdate={loadClients} cobro={settings.cobro} onSaveCobro={handleSaveCobro} currentEmail={user.email} />
                </div>
              )}

              {activeView === 'upload' && (
                <div className="max-w-2xl mx-auto pt-4 md:pt-10 animate-in-slide">
                  <ExcelUpload userId={workspaceId} onImport={handleImport} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedClient && (
          <MessagePreview
            client={selectedClient}
            templates={settings.templates}
            cobro={settings.cobro}
            onSent={handleMessageSent}
            onClose={() => setSelectedClient(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheetClient && (
          <ClientSheet
            client={sheetClient}
            userId={workspaceId}
            payments={payments.filter(p => p.client_id === sheetClient.id)}
            templates={settings.templates}
            cobro={settings.cobro}
            onClose={() => setSheetClientId(null)}
            onEdit={openEdit}
            onRegisterPayment={setPaymentClient}
            onSent={handleMessageSent}
            onToggleBaja={handleToggleBaja}
          />
        )}
      </AnimatePresence>

      {increaseQueue && (
        <SendQueue
          title="Aviso de aumento de precio"
          clients={increaseQueue}
          templates={settings.templates}
          cobro={settings.cobro}
          templateKey="increase"
          onSent={handleMessageSent}
          onClose={() => setIncreaseQueue(null)}
        />
      )}

      <AnimatePresence>
        {paymentClient && (
          <PaymentDialog
            client={paymentClient}
            templates={settings.templates}
            cobro={settings.cobro}
            onClose={() => setPaymentClient(null)}
            onConfirm={handleRegisterPayment}
            onNotified={(client) => handleMessageSent(client, 'paid')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDialogOpen && (
          <ClientDialog
            client={clientToEdit}
            plans={settings.planes}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleSaveClient}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/** La página completa, con el aviso de cambios sin guardar disponible para todas las pantallas. */
const Index = () => (
  <UnsavedChangesProvider>
    <IndexPage />
  </UnsavedChangesProvider>
);

export default Index;
