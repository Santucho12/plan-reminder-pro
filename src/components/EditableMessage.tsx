import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface EditableMessageProps {
  message: string;
  onSave: (newMessage: string) => void;
  className?: string;
  highlightColor?: string;
}

const EditableMessage = ({ message, onSave, className = '', highlightColor = 'text-slate-900 dark:text-white' }: EditableMessageProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(message);
    setEditing(false);
  };

  // Render message with placeholders highlighted
  const renderMessage = (text: string) => {
    const parts = text.split(/(\[(?:Nombre|Plan|Total|Link Mercado Pago)\])/g);
    return parts.map((part, i) =>
      part.match(/^\[(?:Nombre|Plan|Total|Link Mercado Pago)\]$/)
        ? <span key={i} className={`${highlightColor} font-bold`}>{part}</span>
        : part
    );
  };

  if (editing) {
    return (
      <div className={`space-y-3 ${className}`}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="text-sm font-medium leading-relaxed resize-none rounded-xl border-primary/30 focus:border-primary w-full"
        />
        <p className="text-[10px] text-muted-foreground">
          Variables disponibles: <code>[Nombre]</code>, <code>[Plan]</code>, <code>[Total]</code>, <code>[Link Mercado Pago]</code>
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
          >
            <X size={14} /> Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Check size={14} /> Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      <div className="font-medium leading-relaxed italic">
        "{renderMessage(message)}"
      </div>
      <button
        onClick={() => setEditing(true)}
        className="absolute top-2 right-2 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-border/60 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:bg-primary/10"
        title="Editar mensaje"
      >
        <Pencil size={14} className="text-primary" />
      </button>
    </div>
  );
};

export default EditableMessage;
