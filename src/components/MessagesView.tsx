import { useState } from 'react';
import { differenceInCalendarDays, isToday } from 'date-fns';
import { Activity, Clock, AlertCircle, RotateCcw, MessageCircle, CheckCircle2, HandCoins, Send, FileText, Pencil, ListOrdered } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { scrollToTop } from '@/lib/smoothScroll';
import EditableMessage from '@/components/EditableMessage';
import SendQueue from '@/components/SendQueue';
import { useConfirmLeave } from '@/hooks/useUnsavedChanges';
import { Client, CobroData } from '@/types/client';
import {
  DEFAULT_COBRO,
  DEFAULT_TEMPLATES,
  MessageSegment,
  MessageTemplates,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TemplateKey,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getSegment,
} from '@/lib/whatsapp';

interface MessagesViewProps {
  clients: Client[];
  templates?: MessageTemplates;
  cobro?: CobroData;
  onSaveTemplate?: (key: TemplateKey, text: string) => void | Promise<void>;
  onSent?: (client: Client, templateKey?: TemplateKey) => void;
  onRegisterPayment?: (client: Client) => void;
  onOpenClient?: (client: Client) => void;
}

const segments: { id: MessageSegment; label: string; title: string; description: string; icon: typeof Activity }[] = [
  { id: 'today', label: 'Vencen hoy', title: 'Vencen hoy', description: 'Clientes a los que hoy se les termina el plan.', icon: Activity },
  { id: 'soon', label: 'Próximos 3 días', title: 'Vencen en los próximos 3 días', description: 'Clientes que vencen en 1 a 3 días y todavía no recibieron el aviso.', icon: Clock },
  { id: 'expired', label: 'Vencidos', title: 'Clientes vencidos (1-30 días)', description: 'Clientes a los que se les terminó el plan hace poco.', icon: AlertCircle },
  { id: 'lost', label: 'Recuperación', title: 'Recuperación de clientes', description: 'Clientes que no renuevan hace más de 30 días.', icon: RotateCcw },
];

const TEMPLATE_HELP: Record<TemplateKey, string> = {
  today: 'Se usa con los clientes a los que hoy se les termina el plan.',
  soon: 'Se usa con los clientes que vencen en los próximos 3 días.',
  expired: 'Se usa con los clientes vencidos hace 1 a 30 días.',
  lost: 'Se usa con los clientes que no renuevan hace más de 30 días.',
  welcome: 'Para enviar desde la ficha de un cliente recién dado de alta.',
  paid: 'Se ofrece al registrar un pago. [Total] es el monto cobrado y [Vencimiento] la nueva fecha.',
  increase: 'Se ofrece al cambiar precios en Plataformas. [Total] es el precio nuevo.',
};

const sentToday = (client: Client) => !!client.ultimoMensaje && isToday(client.ultimoMensaje);

/** "ayer" / "hace 5 días": para no volver a escribirle a alguien a quien ya se le avisó hace poco. */
function lastNotice(client: Client): string | null {
  if (!client.ultimoMensaje || sentToday(client)) return null;
  const days = differenceInCalendarDays(new Date(), client.ultimoMensaje);
  if (days < 1) return null;
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

const MessagesView = ({ clients, templates = DEFAULT_TEMPLATES, cobro = DEFAULT_COBRO, onSaveTemplate, onSent, onRegisterPayment, onOpenClient }: MessagesViewProps) => {
  const [mode, setMode] = useState<'send' | 'templates'>('send');
  const [hideSent, setHideSent] = useState(false);
  /** Cola abierta: recorre de a uno los clientes del grupo a los que todavía no se les escribió hoy. */
  const [queue, setQueue] = useState<{ title: string; clients: Client[] } | null>(null);
  const confirmLeave = useConfirmLeave();

  const bySegment = (id: MessageSegment) =>
    clients
      .filter(c => getSegment(c) === id)
      .sort((a, b) => Number(b.dias) - Number(a.dias));

  /** Cambia entre Envíos y Plantillas arrancando desde arriba. */
  const changeMode = (next: typeof mode) => {
    setMode(next);
    scrollToTop();
  };

  const modeButton = (id: typeof mode, label: string, Icon: typeof Send) => (
    <button
      type="button"
      onClick={() => { if (id !== mode) confirmLeave(() => changeMode(id)); }}
      aria-pressed={mode === id}
      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
        mode === id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex gap-1 p-1.5 mb-6 rounded-2xl bg-card border border-border w-full sm:w-fit">
        {modeButton('send', 'Envíos', Send)}
        {modeButton('templates', 'Plantillas', FileText)}
      </div>

      {mode === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {TEMPLATE_KEYS.map(key => (
            <section key={key} aria-label={`Plantilla ${TEMPLATE_LABELS[key]}`} className="bg-card rounded-[2rem] border border-border/60 shadow-xl p-6 space-y-4">
              <div className="space-y-1">
                <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />{TEMPLATE_LABELS[key]}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{TEMPLATE_HELP[key]}</p>
              </div>
              <div className="bg-[hsl(120_30%_95%)] rounded-2xl rounded-tl-none p-5 text-slate-700">
                <EditableMessage
                  message={templates[key]}
                  defaultMessage={DEFAULT_TEMPLATES[key]}
                  onSave={(text) => onSaveTemplate?.(key, text)}
                />
              </div>
            </section>
          ))}
        </div>
      )}

      {mode === 'send' && (
        <Tabs defaultValue="today" className="w-full">
          <div className="mb-5 md:mb-8">
            <TabsList className="bg-secondary/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/40 h-auto w-full grid grid-cols-2 sm:grid-cols-4 gap-1 xl:w-max xl:flex xl:gap-0">
              {segments.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="px-3 md:px-6 py-2.5 rounded-xl text-[13px] sm:text-sm font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-lg">
                  <Icon className="w-4 h-4 mr-1.5 sm:mr-2 shrink-0" />
                  {label}
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-[10px] font-black">{bySegment(id).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {segments.map(({ id, title, description }) => {
            const all = bySegment(id);
            const pending = all.filter(c => !sentToday(c));
            const list = hideSent ? pending : all;
            return (
              <TabsContent key={id} value={id} className="grid grid-cols-1 xl:grid-cols-3 gap-5 md:gap-8 outline-none animate-in-slide">
                <div className="order-2 xl:order-none xl:col-span-1">
                  <div className="bg-card rounded-3xl md:rounded-[2rem] border border-border/60 shadow-xl p-5 md:p-8 space-y-5 md:space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />{title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
                    </div>
                    <div className="bg-[hsl(120_30%_95%)] rounded-2xl rounded-tl-none p-5 text-slate-700">
                      {/* Vista previa: las plantillas se editan solo desde la pestaña Plantillas */}
                      <EditableMessage message={templates[id]} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] text-muted-foreground">
                        El botón de WhatsApp abre el chat con este mensaje listo para enviar.
                      </p>
                      <button
                        type="button"
                        onClick={() => confirmLeave(() => changeMode('templates'))}
                        className="shrink-0 h-9 px-3 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors flex items-center gap-1.5"
                      >
                        <Pencil size={13} /> Editar en Plantillas
                      </button>
                    </div>
                  </div>
                </div>

                <div className="order-1 xl:order-none xl:col-span-2">
                  <div className="bg-card rounded-3xl md:rounded-[2rem] border border-border/60 shadow-xl overflow-hidden">
                    <div className="px-4 md:px-6 py-4 md:py-5 border-b border-border bg-secondary/20 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-sm md:text-base font-bold tracking-tight uppercase text-muted-foreground/80">Clientes a contactar</h2>
                        <span className="px-2 py-1 bg-secondary rounded-md text-[10px] md:text-xs font-semibold tracking-widest text-muted-foreground uppercase whitespace-nowrap">
                          {list.length} Clientes
                        </span>
                      </div>
                      <div className="flex flex-col-reverse items-stretch sm:flex-row sm:items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap">
                          <input type="checkbox" checked={hideSent} onChange={(e) => setHideSent(e.target.checked)} className="rounded border-border" />
                          Ocultar enviados hoy
                        </label>
                        <button
                          type="button"
                          onClick={() => setQueue({ title, clients: pending })}
                          disabled={pending.length === 0}
                          className="h-11 sm:h-10 px-4 rounded-xl bg-[#25D366] text-white text-sm font-bold shadow-md shadow-[#25D366]/25 hover:bg-[#1fbd5b] active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <ListOrdered size={16} /> Enviar en cola ({pending.length})
                        </button>
                      </div>
                    </div>

                    {list.length === 0 ? (
                      <p className="p-12 text-center text-sm text-muted-foreground font-medium">
                        {all.length === 0 ? 'No hay clientes en este grupo por ahora.' : 'Ya les escribiste hoy a todos los de este grupo.'}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {list.map(client => {
                          const url = buildWhatsAppUrl(client, buildWhatsAppMessage(client, templates, cobro));
                          return (
                            <li key={client.id} className="px-4 md:px-5 py-3 sm:py-2.5 flex items-center gap-2.5 md:gap-3 hover:bg-secondary/40 transition-colors">
                              <div className="w-7 h-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[11px] uppercase">
                                {client.nombre.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-[7rem]">
                                {onOpenClient ? (
                                  <button type="button" onClick={() => onOpenClient(client)} title="Ver ficha" className="block max-w-full text-left hover:text-primary transition-colors">
                                    <p className="text-sm font-semibold truncate">{client.nombre}</p>
                                  </button>
                                ) : (
                                  <p className="text-sm font-semibold truncate">{client.nombre}</p>
                                )}
                                <p className="text-[11px] text-muted-foreground truncate">
                                  <span className="font-mono">{client.celular || 'Sin número'}</span>
                                  {client.plan && <> · {client.plan}</>}
                                </p>
                              </div>
                              <span className="hidden sm:block text-sm font-bold tabular-nums">${client.total.toLocaleString('es-AR')}</span>
                              {lastNotice(client) && (
                                <span className="hidden 2xl:inline text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                                  Último aviso: {lastNotice(client)}
                                </span>
                              )}
                              {sentToday(client) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                  <CheckCircle2 size={14} /> <span className="hidden 2xl:inline">Enviado hoy</span>
                                </span>
                              )}
                              {onRegisterPayment && (
                                <button
                                  type="button"
                                  onClick={() => onRegisterPayment(client)}
                                  title="Registrar pago"
                                  aria-label={`Registrar pago de ${client.nombre}`}
                                  className="inline-flex items-center justify-center gap-1 h-9 min-w-9 sm:h-7 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all whitespace-nowrap"
                                >
                                  <HandCoins size={13} /> <span className="hidden sm:inline">Pagó</span>
                                </button>
                              )}
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => onSent?.(client)}
                                  aria-label={`WhatsApp a ${client.nombre}`}
                                  className="inline-flex items-center justify-center gap-1.5 h-9 min-w-9 sm:h-7 px-2.5 sm:px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#25D366] text-white shadow-md shadow-[#25D366]/20 hover:shadow-[#25D366]/30 active:scale-95 transition-all duration-200"
                                >
                                  <MessageCircle size={15} className="sm:w-[13px] sm:h-[13px]" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </a>
                              ) : (
                                <span className="inline-flex items-center h-7 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground whitespace-nowrap">
                                  Sin número
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {queue && (
        <SendQueue
          title={queue.title}
          clients={queue.clients}
          templates={templates}
          cobro={cobro}
          onSent={onSent}
          onRegisterPayment={onRegisterPayment}
          onClose={() => setQueue(null)}
        />
      )}
    </div>
  );
};

export default MessagesView;
