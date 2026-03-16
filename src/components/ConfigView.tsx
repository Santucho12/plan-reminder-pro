import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, QrCode, CreditCard, Save, Settings } from 'lucide-react';
import { fetchUserConfig, updateUserConfig } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

interface ConfigViewProps {
  userId: string;
}

const ConfigView = ({ userId }: ConfigViewProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [mpToken, setMpToken] = useState('');

  const loadConfig = async () => {
    try {
      const data = await fetchUserConfig(userId);
      setConfig(data);
      if (data?.mp_access_token) setMpToken(data.mp_access_token);
    } catch (err) {
      console.error('Error loading config:', err);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();

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
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
      {/* WhatsApp Integration */}
      <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden group">
        <div className="p-8 border-b border-white/5 bg-gradient-to-br from-emerald-500/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
              <QrCode className="text-emerald-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase">WhatsApp</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Canal de Notificación</p>
            </div>
          </div>
          {config?.wpp_status === 'connected' ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.5)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              Conectado
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-muted-foreground text-[10px] font-black uppercase tracking-widest border border-white/5">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              Desconectado
            </div>
          )}
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
          {config?.wpp_status === 'connected' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center relative border border-emerald-500/30 mx-auto">
                  <CheckCircle2 size={40} className="text-emerald-400" strokeWidth={3} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black tracking-tighter text-white">¡Operativo!</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
                  El motor de WhatsApp está activo y listo para procesar envíos automáticos.
                </p>
              </div>
              <button 
                onClick={() => updateUserConfig(userId, { wpp_status: 'disconnected', wpp_qr_code: null })}
                className="px-6 py-2 rounded-xl text-[10px] font-black text-red-400 hover:bg-red-400/10 transition-all uppercase tracking-widest border border-red-400/10"
              >
                Desvincular Dispositivo
              </button>
            </motion.div>
          ) : config?.wpp_status === 'pending_qr' && config?.wpp_qr_code ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="relative p-6 bg-white rounded-[2rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] inline-block group/qr">
                <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-2xl group-hover/qr:blur-3xl transition-all" />
                <div className="relative">
                  <QRCodeSVG value={config.wpp_qr_code} size={200} />
                </div>
              </div>
              <div className="space-y-4 glass p-6 rounded-2xl border-white/5">
                <p className="text-xs font-black uppercase tracking-widest text-primary">Próximos Pasos</p>
                <div className="text-[11px] text-muted-foreground text-left space-y-3 font-medium">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">1</span>
                    <p>Abrí <strong>WhatsApp</strong> en tu teléfono móvil</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">2</span>
                    <p>Vinculá el dispositivo desde <strong>Ajustes</strong></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">3</span>
                    <p>Escaneá el código QR central</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6 py-10">
              <div className="w-20 h-20 rounded-3xl bg-secondary/30 flex items-center justify-center mx-auto border border-white/5">
                <XCircle className="text-muted-foreground/30" size={40} strokeWidth={1} />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-bold text-white">Sin Dispositivos</p>
                <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                  Generá un token de vinculación para activar el bot.
                </p>
              </div>
              <button 
                onClick={() => updateUserConfig(userId, { wpp_status: 'pending_qr' })}
                className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all"
              >
                Vincular WhatsApp Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mercado Pago Integration */}
      <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden group h-fit">
        <div className="p-8 border-b border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
              <CreditCard className="text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase">Mercado Pago</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Procesador de Pagos</p>
            </div>
          </div>
          {config?.mp_access_token ? (
            <div className="px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
              Activo
            </div>
          ) : (
            <div className="px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-widest border border-orange-500/20 animate-pulse">
              Pendiente
            </div>
          )}
        </div>
        
        <div className="p-8 space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              Access Token de Configuración
            </label>
            <div className="space-y-4">
              <input 
                type="password"
                value={mpToken}
                onChange={(e) => setMpToken(e.target.value)}
                placeholder="APP_USR-XXXXX-XXXXX..."
                className="w-full glass border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none font-mono text-white transition-all"
              />
              <button 
                onClick={handleSaveMP}
                disabled={saving}
                className="w-full py-4 rounded-2xl bg-white/5 text-white font-black text-[10px] uppercase tracking-[0.2em] border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Actualizar Credenciales
              </button>
            </div>
          </div>

          <div className="p-6 glass bg-blue-500/5 rounded-[2rem] border-blue-500/10 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Settings size={18} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest text-white">Guía de Seguridad</h4>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
              Obtené tu Access Token desde el <a href="https://www.mercadopago.com.ar/developers/panel/credentials" target="_blank" rel="noreferrer" className="text-blue-400 font-bold hover:underline">Panel de Developers</a>. Nunca compartas este código con terceros; es la llave maestra de tus cobros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigView;
