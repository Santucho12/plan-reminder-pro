import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Lock, Save, ShieldCheck, UserCog } from 'lucide-react';
import { Member, fetchMembers, updateConfigurableUser } from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface AccessSettingsProps {
  /** Mail del usuario logueado, para marcar cuál es "vos". */
  currentEmail?: string;
}

const inputClass = 'w-full h-12 rounded-xl bg-secondary/30 border-none px-4 text-sm font-semibold focus:ring-2 focus:ring-primary/20 transition-all';
const labelClass = 'text-[10px] font-black text-muted-foreground uppercase tracking-widest';
const MIN_PASSWORD = 6;
/** Campo de contraseña con botón de ojo para mostrarla u ocultarla. */
const PasswordInput = ({ id, label, value, onChange, readOnly, placeholder }: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={readOnly ? 'off' : 'new-password'}
          value={value}
          readOnly={readOnly}
          // Solo lectura: no recibe foco ni se puede seleccionar (solo se ve, con el ojo)
          tabIndex={readOnly ? -1 : undefined}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${inputClass} pr-12 font-mono ${
            readOnly ? 'pointer-events-none select-none cursor-default focus:ring-0 focus:outline-none text-slate-700 dark:text-slate-200' : ''
          }`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

/** Usuarios con acceso: el admin es fijo; al usuario configurable se le cambia mail y contraseña. */
const AccessSettings = ({ currentEmail }: AccessSettingsProps) => {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchMembers();
      setMembers(list);
      setEmail(list.find(m => m.rol === 'usuario')?.email ?? '');
      setLoadError('');
    } catch (err: any) {
      setLoadError(err?.message || 'No se pudieron cargar los usuarios');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const admin = members?.find(m => m.rol === 'admin');
  const usuario = members?.find(m => m.rol === 'usuario');
  useUnsavedChanges(!!usuario && (password !== '' || email.trim().toLowerCase() !== usuario.email.toLowerCase()));

  const isMe = (member?: Member) => !!member && !!currentEmail && member.email.toLowerCase() === currentEmail.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario || saving) return;
    setError('');

    const newEmail = email.trim().toLowerCase();
    const changes: { email?: string; password?: string } = {};
    if (newEmail && newEmail !== usuario.email.toLowerCase()) changes.email = newEmail;
    if (password) {
      if (password.length < MIN_PASSWORD) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      changes.password = password;
    }
    if (!changes.email && !changes.password) return setError('No hay cambios para guardar.');

    setSaving(true);
    try {
      await updateConfigurableUser(changes);
      toast.success('Usuario actualizado');
      setPassword('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el usuario');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6" aria-label="Accesos">
      <div className="flex items-center gap-3 px-1">
        <div className="w-1 h-6 bg-primary rounded-full" />
        <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Accesos</h2>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-2xl p-4">{loadError}</p>
      ) : !members ? (
        <p className="text-sm text-muted-foreground px-1">Cargando usuarios...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-card rounded-[2rem] border border-border/50 shadow-xl p-5 md:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <ShieldCheck className="text-primary" size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold">Administrador {isMe(admin) && <span className="text-xs text-primary">(vos)</span>}</h3>
                <p className="text-sm text-muted-foreground font-mono truncate">{admin?.email ?? '—'}</p>
              </div>
            </div>
            <PasswordInput id="acceso-admin-password" label="Contraseña" value={admin?.clave ?? ''} readOnly placeholder="No disponible" />
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock size={14} className="shrink-0 mt-0.5" />
              Usuario fijo del sistema: su mail y contraseña no se pueden modificar.
            </p>
          </div>

          <form onSubmit={handleSubmit} aria-label="Usuario configurable" className="bg-card rounded-[2rem] border border-border/50 shadow-xl p-5 md:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <UserCog className="text-primary" size={24} />
              </div>
              <div>
                <h3 className="font-bold">Usuario {isMe(usuario) && <span className="text-xs text-primary">(vos)</span>}</h3>
                <p className="text-xs text-muted-foreground">Comparte los mismos clientes y datos que el administrador.</p>
              </div>
            </div>

            {usuario ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="acceso-email" className={labelClass}>Mail</label>
                  <input id="acceso-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </div>
                <PasswordInput id="acceso-actual" label="Contraseña actual" value={usuario.clave ?? ''} readOnly placeholder="No disponible" />
                <PasswordInput id="acceso-password" label="Contraseña nueva" value={password} onChange={setPassword} placeholder="Sin cambios" />
                {!usuario.clave && (
                  <p className="text-xs text-muted-foreground">
                    La contraseña actual se va a ver acá después de cambiarla una vez desde esta pantalla.
                  </p>
                )}

                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="h-12 px-6 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {saving ? <KeyRound size={14} /> : <Save size={14} />} {saving ? 'Guardando...' : 'Guardar usuario'}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hay usuario configurable creado.</p>
            )}
          </form>
        </div>
      )}
    </section>
  );
};

export default AccessSettings;
