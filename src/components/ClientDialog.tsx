import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User, Phone, Calendar, CreditCard, Tag } from 'lucide-react';
import { Client } from '@/types/client';
import { format } from 'date-fns';

interface ClientDialogProps {
  client: Client | null; // null for new client
  onClose: () => void;
  onSave: (clientData: any) => Promise<void>;
}

const ClientDialog = ({ client, onClose, onSave }: ClientDialogProps) => {
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    plan: '',
    vencimiento: format(new Date(), 'yyyy-MM-dd'),
    total: 0,
    estado: 'activo'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        nombre: client.nombre,
        celular: client.celular,
        plan: client.plan,
        vencimiento: format(client.vencimiento, 'yyyy-MM-dd'),
        total: client.total,
        estado: client.estado
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving client:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-border bg-secondary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {client ? <Save size={18} /> : <User size={18} />}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {client ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <User size={12} className="text-primary" /> Nombre Completo
              </label>
              <input
                required
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Ej: Juan Pérez"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Phone size={12} className="text-primary" /> Celular (WhatsApp)
                </label>
                <input
                  required
                  type="text"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                  className="w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                  placeholder="549..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Tag size={12} className="text-primary" /> Plataforma / Plan
                </label>
                <input
                  required
                  type="text"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  className="w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej: Netflix 4K"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={12} className="text-primary" /> Vencimiento
                </label>
                <input
                  required
                  type="date"
                  value={formData.vencimiento}
                  onChange={(e) => setFormData({ ...formData, vencimiento: e.target.value })}
                  className="w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={12} className="text-primary" /> Importe Total
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                  <input
                    required
                    type="number"
                    value={formData.total}
                    min="0"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData({ ...formData, total: val < 0 ? 0 : val });
                    }}
                    className="w-full h-12 rounded-xl bg-secondary/30 border-none pl-8 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-secondary text-foreground font-bold text-[10px] uppercase tracking-widest hover:bg-secondary/80 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {client ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ClientDialog;
