import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, QrCode, CreditCard, Save } from 'lucide-react';
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
    <div className="grid gap-6 max-w-2xl">
      {/* WhatsApp Integration */}
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <QrCode className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">WhatsApp Business</h3>
              <p className="text-xs text-muted-foreground">Conectá tu cuenta para automatizar envíos</p>
            </div>
          </div>
        </div>
        
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
          {config?.wpp_status === 'connected' ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-green-600">
                <CheckCircle2 size={48} strokeWidth={1.5} />
                <p className="text-lg font-medium mt-2">WhatsApp Conectado</p>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Tu cuenta está vinculada correctamente. El bot procesará los mensajes programados.
              </p>
              <button 
                onClick={() => updateUserConfig(userId, { wpp_status: 'disconnected', wpp_qr_code: null })}
                className="text-xs text-destructive hover:underline"
              >
                Desvincular cuenta
              </button>
            </div>
          ) : config?.wpp_status === 'pending_qr' && config?.wpp_qr_code ? (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl shadow-inner border border-border inline-block">
                <QRCodeSVG value={config.wpp_qr_code} size={200} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Escaneá el código QR</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Abrí WhatsApp en tu teléfono {`>`} Dispositivos vinculados {`>`} Vincular un dispositivo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <XCircle className="text-muted-foreground mx-auto" size={48} strokeWidth={1} />
              <div className="space-y-1">
                <p className="text-sm font-medium">WhatsApp Desconectado</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Asegurate de que el bot local esté corriendo para generar un nuevo código QR.
                </p>
              </div>
              <button 
                onClick={() => updateUserConfig(userId, { wpp_status: 'pending_qr' })}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
              >
                Generar código QR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mercado Pago Integration */}
      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="p-6 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CreditCard className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Mercado Pago</h3>
              <p className="text-xs text-muted-foreground">Configurá tus credenciales para cobrar</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Access Token (Producción)
            </label>
            <div className="flex gap-2">
              <input 
                type="password"
                value={mpToken}
                onChange={(e) => setMpToken(e.target.value)}
                placeholder="APP_USR-..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none font-mono"
              />
              <button 
                onClick={handleSaveMP}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Guardar
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Obtenelo desde el <a href="https://www.mercadopago.com.ar/developers/panel/credentials" target="_blank" rel="noreferrer" className="text-primary hover:underline">Panel de Desarrolladores</a>.
            </p>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Estado de la cuenta</span>
            {config?.mp_access_token ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-paid text-status-paid-text uppercase">
                <CheckCircle2 size={10} /> Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-status-pending text-status-pending-text uppercase">
                Pendiente
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigView;
