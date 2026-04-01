import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import ExcelUpload from './ExcelUpload';
import { Loader2, CheckCircle2, XCircle, QrCode, CreditCard, Save, Settings, FileSpreadsheet, Database } from 'lucide-react';
import { fetchUserConfig, updateUserConfig } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface ConfigViewProps {
  userId: string;
  onDataUpdate?: () => void;
}

const ConfigView = ({ userId, onDataUpdate }: ConfigViewProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [mpToken, setMpToken] = useState('');

  const loadConfig = async () => {
    try {
      const data = await fetchUserConfig(userId);
      setConfig(data);
      if (data && (data as any).mp_access_token) setMpToken((data as any).mp_access_token);
    } catch (err) {
      console.error('Error loading config:', err);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();

    // Suscribirse a cambios en tiempo real para el QR de WhatsApp
    const channel = supabase
      .channel('config-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_configs', filter: `user_id=eq.${userId}` },
        (payload) => {
          setConfig(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleSaveMP = async () => {
    setSaving(true);
    try {
      await updateUserConfig(userId, { mp_access_token: mpToken });
      toast.success('Configuración de Mercado Pago guardada');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-10">

      {/* Sección 1: Integraciones y Conectividad */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-1">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Centro de Conexion</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tarjeta WhatsApp: Estilo Conectividad */}
          <div className="relative group bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col min-h-[420px] transition-all hover:border-primary/30">
            <div className="p-6 border-b border-border/40 bg-gradient-to-br from-emerald-500/[0.03] to-transparent flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                  <QrCode className="text-emerald-600" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">WhatsApp Business</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">Sistema de mensajes</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                {config?.wpp_status === 'connected' ? (
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-border text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Offline
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
              {config?.wpp_status === 'connected' ? (
                <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 rounded-full bg-emerald-500/5 flex items-center justify-center mx-auto border border-emerald-500/10 relative">
                    <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full animate-pulse" />
                    <CheckCircle2 size={48} className="text-emerald-500 relative z-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-800 dark:text-white">Bot en Funcionamiento</h4>
                    <p className="text-sm text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                      Tu cuenta está vinculada y lista para automatizar las cobranzas.
                    </p>
                  </div>
            
                </div>
              ) : config?.wpp_status === 'pending_qr' && config?.wpp_qr_code ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 w-full">
                  <div className="relative inline-block p-4 bg-white rounded-3xl shadow-2xl border border-emerald-100">
                    <QRCodeSVG value={config.wpp_qr_code} size={180} />
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-border/60 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 text-center">Instrucciones de Vinculación</p>
                    <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-2 font-medium">
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] shrink-0">1</span>
                        Abrí WhatsApp en tu dispositivo móvil
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] shrink-0">2</span>
                        Configuración → Dispositivos vinculados
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto border border-border shadow-inner">
                    <XCircle className="text-slate-300" size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold">Sin Conexión Activa</h4>
                    <p className="text-xs text-muted-foreground mx-auto max-w-[220px]">
                      Habilitá el bot para empezar a enviar recordatorios automáticos.
                    </p>
                  </div>
                  <button
                    onClick={() => updateUserConfig(userId, { wpp_status: 'pending_qr' })}
                    className="px-8 py-4 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                  >
                    Generar Código QR de Acceso
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta Mercado Pago: Estilo Pagos */}
          <div className="relative group bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden flex flex-col min-h-[420px] transition-all hover:border-blue-500/30">
            <div className="p-6 border-b border-border/40 bg-gradient-to-br from-blue-500/[0.03] to-transparent flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <CreditCard className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Mercado Pago</h3>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/70">Procesador de Cobros</p>
                </div>
              </div>

              {config?.mp_access_token ? (
                <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                  Listo
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  Pendiente
                </div>
              )}
            </div>

            <div className="flex-1 p-8 space-y-8">
              <div className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Credencial</label>
                  <a href="https://www.mercadopago.com.ar/developers/panel/credentials" target="_blank" rel="noreferrer" className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                    Obtener llaves <Settings size={10} />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type="password"
                    value={mpToken}
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder="APP_USR-..."
                    className="w-full rounded-2xl border-none bg-white dark:bg-slate-900 px-5 py-4 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner placeholder:text-slate-300"
                  />
                </div>

                <button
                  onClick={handleSaveMP}
                  disabled={saving}
                  className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Guardar Credencial
                </button>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/50 border border-border/60">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
                  <Settings size={14} className="text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Seguridad de Transacción</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-medium">
                    Tus llaves se encriptan bajo estándares bancarios y solo se usan para generar links de pago seguros.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección 2: Gestión de Datos */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center gap-3 px-1">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Base de Datos</h2>
        </div>

        <div className="bg-card rounded-[2.5rem] border border-border/50 shadow-2xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Database className="text-primary" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic">Sincronizacion y Backup</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Actualizá la plataforma en segundos subiendo tu excel de clientes
                </p>
              </div>

              <div className="pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-pulse-subtle">
                  <XCircle size={14} className="shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    ¡Cuidado! El nuevo Excel reemplazara la lista actual
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-border/60 p-8 flex flex-col justify-center">
              <ExcelUpload
                onImport={() => {
                  if (onDataUpdate) onDataUpdate();
                  toast.success('¡Base de datos actualizada con éxito!');
                }}
                userId={userId}
              />
              <div className="mt-6 flex items-center gap-3 justify-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <FileSpreadsheet size={14} />
                Soporta archivos .xlsx, .xls y .csv
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default ConfigView;
