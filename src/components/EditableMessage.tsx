import { useState } from 'react';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import { TEMPLATE_VARIABLES, VARIABLE_SPLIT_PATTERN } from '@/lib/whatsapp';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface EditableMessageProps {
  message: string;
  /** Sin onSave el mensaje es solo de lectura (vista previa). */
  onSave?: (newMessage: string) => void | Promise<void>;
  /** Texto original: si se pasa, se ofrece restablecerlo al editar. */
  defaultMessage?: string;
  className?: string;
  highlightColor?: string;
}


const EditableMessage = ({ message, onSave, defaultMessage, className = '', highlightColor = 'text-primary' }: EditableMessageProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(message);
  const confirmDiscard = useUnsavedChanges(editing && draft !== message);

  const handleSave = async () => {
    if (draft.trim() === '' || !onSave) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // El error lo informa quien guarda; se mantiene el borrador para reintentar
    } finally {
      setSaving(false);
    }
  };

  // Render message with placeholders highlighted
  const renderMessage = (text: string) =>
    text.split(VARIABLE_SPLIT_PATTERN).map((part, i) =>
      (TEMPLATE_VARIABLES as readonly string[]).includes(part)
        ? <span key={i} className={`${highlightColor} font-bold`}>{part}</span>
        : part
    );

  if (editing) {
    return (
      <div className={`space-y-3 ${className}`}>
        <textarea
          aria-label="Texto del mensaje"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={9}
          className="w-full rounded-xl border border-primary/30 bg-background p-3 text-sm font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Variables disponibles: {TEMPLATE_VARIABLES.map((v, i) => (
            <span key={v}>{i > 0 && ', '}<code>{v}</code></span>
          ))}. Se reemplazan con los datos de cada cliente.
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          {defaultMessage !== undefined && (
            <button
              type="button"
              onClick={() => setDraft(defaultMessage)}
              className="mr-auto px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Restablecer
            </button>
          )}
          <button
            type="button"
            onClick={() => confirmDiscard(() => setEditing(false))}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || draft.trim() === ''}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check size={14} /> Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className={`${onSave ? 'pr-10 ' : ''}text-sm font-medium leading-relaxed whitespace-pre-line`}>
        {renderMessage(message)}
      </div>
      {onSave && (
      <button
        type="button"
        onClick={() => { setDraft(message); setEditing(true); }}
        className="absolute top-0 right-0 p-2 rounded-xl bg-white/80 border border-border/60 shadow-sm transition-all hover:scale-110 hover:bg-primary/10"
        title="Editar mensaje"
        aria-label="Editar mensaje"
      >
        <Pencil size={14} className="text-primary" />
      </button>
      )}
    </div>
  );
};

export default EditableMessage;
