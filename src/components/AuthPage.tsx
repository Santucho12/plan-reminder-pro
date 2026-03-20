import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Zap } from 'lucide-react';

interface AuthPageProps {
  onAuth: () => void;
}

const AuthPage = ({ onAuth }: AuthPageProps) => {
  const isLogin = true;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onAuth();
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px] -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10 text-center animate-in-fade">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 mb-4 rotate-3">
            <Zap className="text-white fill-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight leading-none text-slate-900">
              Fiesta<span className="text-primary">Cobra</span>
            </h1>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">
              Cobrando en automático
            </p>
          </div>
        </div>

        <div className="bg-card/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-white/50 p-10">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 mb-8 px-1">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block px-1">Email</label>
               <div className="relative">
                 <Mail size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                 <input
                   type="email"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full h-12 rounded-xl border-none bg-secondary/30 pl-10 pr-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                   placeholder="tu@email.com"
                   required
                 />
               </div>
             </div>
 
             <div>
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block px-1">Contraseña</label>
               <div className="relative">
                 <Lock size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                 <input
                   type="password"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full h-12 rounded-xl border-none bg-secondary/30 pl-10 pr-3 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                   placeholder="••••••••"
                   required
                   minLength={6}
                 />
               </div>
             </div>

            {error && (
              <p className="text-sm text-destructive bg-status-overdue p-2 rounded-md">{error}</p>
            )}

            <button
               type="submit"
               disabled={loading}
               className="w-full h-14 rounded-2xl bg-primary text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-10"
             >
               {loading && <Loader2 size={16} className="animate-spin" />}
               Ingresar a la Plataforma
             </button>
          </form>

        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
