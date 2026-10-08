import { useState, useEffect, useMemo } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User, Phone, Calendar, CreditCard, Tag } from 'lucide-react';
import { Client, Plan } from '@/types/client';
import { format } from 'date-fns';

interface ClientDialogProps {
  client: Client | null; // null for new client
  onClose: () => void;
  onSave: (clientData: any) => Promise<void>;
  /** Catálogo de plataformas: se sugieren al escribir y completan el importe. */
  plans?: Plan[];
}

const ClientDialog = ({ client, onClose, onSave, plans = [] }: ClientDialogProps) => {
  /** Datos con los que abre el formulario: los del cliente, o vacío para un alta. */
  const initialData = useMemo(() => (client ? {
    nombre: client.nombre,
    celular: client.celular,
    plan: client.plan,
    vencimiento: format(client.vencimiento, 'yyyy-MM-dd'),
    total: client.total,
    nota_plataforma: client.nota_plataforma || '',
    nota_precio: client.nota_precio || ''
  } : {
    nombre: '',
    celular: '',
    plan: '',
    vencimiento: format(new Date(), 'yyyy-MM-dd'),
    total: 0,
    nota_plataforma: '',
    nota_precio: ''
  }), [client]);
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const confirmDiscard = useUnsavedChanges(JSON.stringify(formData) !== JSON.stringify(initialData));
  const close = () => confirmDiscard(onClose);

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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in-fade">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 sm:py-5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {client ? <Save size={18} /> : <User size={18} />}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {client ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
          </div>
          <button type="button" aria-label="Cerrar"
            onClick={close}
            className="p-2 rounded-full hover:bg-secondary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-6 pt-5 sm:pt-6 space-y-5">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  onChange={(e) => {
                    const plan = e.target.value;
                    // Al elegir un plan del catálogo se propone su precio si todavía no se cargó un importe
                    const match = plans.find(p => p.nombre.toLowerCase() === plan.trim().toLowerCase());
                    setFormData({ ...formData, plan, total: match && !formData.total ? match.precio : formData.total });
                  }}
                  list="catalogo-planes"
                  className="w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Ej: Netflix 4K"
                />
                <datalist id="catalogo-planes">
                  {plans.map(p => <option key={p.nombre} value={p.nombre} />)}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Tag size={12} className="text-primary" /> Nota Plataforma (Opcional)
                </label>
                <textarea
                  value={formData.nota_plataforma}
                  onChange={(e) => setFormData({ ...formData, nota_plataforma: e.target.value })}
                  className="w-full min-h-[80px] rounded-xl bg-secondary/30 border-none p-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="Notas sobre la plataforma..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={12} className="text-primary" /> Nota Precio (Opcional)
                </label>
                <textarea
                  value={formData.nota_precio}
                  onChange={(e) => setFormData({ ...formData, nota_precio: e.target.value })}
                  className="w-full min-h-[80px] rounded-xl bg-secondary/30 border-none p-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="Notas sobre el precio..."
                />
              </div>
            </div>

          </div>

          {/* Fija abajo: en el celular el formulario es largo y el botón quedaba fuera de la pantalla */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-6 px-5 sm:px-6 py-4 border-t border-border bg-card flex gap-3">
            <button
              type="button"
              onClick={close}
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
