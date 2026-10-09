import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';

export type HelpModule = 'dashboard' | 'clientes' | 'mensajes' | 'plataformas' | 'config';

interface HelpContent {
  title: string;
  intro: string;
  sections: { title: string; items: string[] }[];
}

/** Explicación de cada pantalla, en el lenguaje del usuario. */
export const HELP: Record<HelpModule, HelpContent> = {
  dashboard: {
    title: 'Cómo funciona el Dashboard',
    intro: 'Es el resumen de tu negocio: cuántos clientes tenés en cada situación, cuánto cobraste y qué hay que atender hoy. Todos los números salen de tus clientes y de los pagos registrados en la app; no hay datos de ejemplo.',
    sections: [
      {
        title: 'Las 4 tarjetas de arriba',
        items: [
          'Activos: todos los que tienen el plan vigente, incluidos los que vencen hoy y en los próximos días.',
          'Vencen hoy: a los que hoy se les termina el plan. Son los primeros a los que hay que cobrarles.',
          'Por vencer: vencen en 1 a 3 días.',
          'Vencidos: se les venció el plan hace 1 a 30 días; todavía se les cobra. Los que llevan más de 30 días figuran abajo como "en recuperación" y ya no cuentan como deuda.',
          'Los clientes dados de baja no cuentan en ninguna tarjeta.',
        ],
      },
      {
        title: 'Cobranza del mes',
        items: [
          'Cobrado este mes: la suma de los pagos registrados con el botón "Registrar pago" (o "Pagó"). Si cobrás y solo cambiás la fecha a mano o reimportás el Excel, ese cobro no se cuenta.',
          'Por cobrar: lo que suman los que vencen hoy más los vencidos de 1 a 30 días.',
          'Cartera vigente: lo que pagan por mes todos los clientes activos.',
          'Eficiencia de cobro: qué porcentaje de lo cobrable ya cobraste este mes (cobrado ÷ cobrado + por cobrar).',
          'Si el mes anterior tuvo cobros, aparece la variación en % contra ese mes.',
        ],
      },
      {
        title: 'Gráficos y últimos pagos',
        items: [
          'Cobrado últimos 6 meses: una barra por mes con lo que registraste en pagos.',
          'Cartera por plataforma: las 5 plataformas que más aportan a la cartera vigente. Si los clientes no tienen plataforma cargada aparecen como "Sin plan".',
          'Últimos pagos: los 5 más recientes. Con la flecha ↶ deshacés un pago cargado por error: se borra y el cliente vuelve a su vencimiento anterior.',
        ],
      },
      {
        title: 'Acciones urgentes',
        items: [
          'Abajo tenés las listas "Vencen hoy" y "Próximos 3 días" con los mismos botones que en Clientes: WhatsApp, registrar pago, editar y ver la ficha.',
          'La lista se actualiza sola cuando alguien modifica un cliente (por ejemplo, el otro usuario).',
        ],
      },
    ],
  },
  clientes: {
    title: 'Cómo funciona Clientes',
    intro: 'Acá está toda tu base: buscás, filtrás, das de alta, editás y cobrás a cada cliente.',
    sections: [
      {
        title: 'Buscar y filtrar',
        items: [
          'El buscador filtra por nombre.',
          'Plataforma: muestra solo los clientes de un plan.',
          'Estado: Activo (vence en más de 3 días), Por vencer (1 a 3 días), Vence hoy o Vencido. El estado se calcula solo con la fecha de vencimiento.',
          'Ordenar: por mayor o menor monto.',
        ],
      },
      {
        title: 'La tabla',
        items: [
          'Días: cuántos días faltan para el vencimiento (negativo si ya venció). Rojo = vence hoy, amarillo = 1 a 3 días, gris = vencido.',
          'Si el cliente tiene notas de plataforma o de precio, aparece un globito al lado: pasá el mouse por encima para leerlas.',
          'Una etiqueta violeta indica que el cliente está dado de baja.',
        ],
      },
      {
        title: 'Acciones de cada cliente',
        items: [
          'WhatsApp: muestra el mensaje que corresponde según su vencimiento y abre el chat con el texto listo para enviar. Queda registrado como último mensaje.',
          'Pagó / Registrar pago: cargás el monto, el medio y por cuántos meses renueva. Se suma siempre desde su vencimiento, aunque haya pagado tarde: si venció el 5 y paga el 8, el próximo vencimiento es el 5 del mes siguiente. Solo si estuvo sin pagar más tiempo del que renueva se cuenta desde el día del pago. Al terminar podés avisarle por WhatsApp con la plantilla "Pago recibido".',
          'Editar (lápiz): nombre, celular, plataformas, vencimiento, importe y notas. La nota de precio sirve para marcar precios especiales que no querés que cambien con los aumentos.',
          'Un cliente puede tener varias plataformas o combos, cada uno con su cantidad: por ejemplo 2 cuentas de Disney+ y YouTube Premium. Usá "+ Agregar plataforma o combo" y los botones − / +. El importe se completa solo con el precio del catálogo (precio × cantidad) y lo podés cambiar.',
          'Eliminar (tacho): borra al cliente. Sus pagos quedan en el historial de cobros.',
        ],
      },
      {
        title: 'La ficha del cliente',
        items: [
          'Tocá el nombre de un cliente para abrir su ficha: datos, notas, historial de pagos, mensajes enviados y notas internas, todo en orden de fecha.',
          'Desde la ficha podés enviar cualquier plantilla (por ejemplo Bienvenida o Aumento), registrar un pago, editar o agregar notas.',
          'Dar de baja: el cliente deja de aparecer en Mensajes y no cuenta en el dashboard, pero no se borra. Se puede reactivar desde la misma ficha.',
        ],
      },
      {
        title: 'Nuevo cliente y Exportar',
        items: [
          'Nuevo Cliente: alta manual. El celular se normaliza solo al formato de WhatsApp (549 + código de área + número).',
          'Exportar Excel: descarga toda la base con colores por estado.',
        ],
      },
    ],
  },
  mensajes: {
    title: 'Cómo funciona Mensajes',
    intro: 'Te arma la lista de a quién escribirle hoy y el mensaje para cada uno. Los mensajes se envían desde tu propio WhatsApp: la app abre el chat con el texto ya escrito y vos tocás enviar.',
    sections: [
      {
        title: 'Los grupos (pestañas)',
        items: [
          'Vencen hoy: clientes a los que hoy se les termina el plan.',
          'Próximos 3 días: vencen en 1 a 3 días. Cada cliente aparece hasta que le mandás el recordatorio, así no se pierde si un día no abrís la app.',
          'Vencidos: se les venció el plan hace 1 a 30 días.',
          'Recuperación: llevan más de 30 días sin renovar.',
          'Los dados de baja no aparecen en ningún grupo. El número de cada pestaña es la cantidad de clientes del grupo.',
        ],
      },
      {
        title: 'Enviar de a uno',
        items: [
          'Botón WhatsApp de cada fila: abre el chat con el mensaje del grupo. El cliente queda marcado "Enviado hoy".',
          '"Último aviso: hace X días" te muestra si ya le escribiste hace poco.',
          '"Ocultar enviados hoy" deja en la lista solo a los que te faltan.',
          'Pagó: registra el pago sin salir de la pantalla.',
        ],
      },
      {
        title: 'Enviar en cola (la forma rápida)',
        items: [
          'Recorre de a uno a todos los del grupo a los que todavía no les escribiste hoy, sin tener que buscar quién sigue.',
          '1) Tocá "Enviar en cola". 2) "Enviar y seguir" abre WhatsApp con el mensaje listo. 3) Envialo y volvé a la app: ya está cargado el siguiente.',
          'Saltar: pasa al siguiente sin escribirle. Pagó: registra el pago de ese cliente.',
          'Si cerrás la cola a la mitad, al abrirla de nuevo arranca solo con los que faltan.',
        ],
      },
      {
        title: 'Plantillas',
        items: [
          'En la pestaña Plantillas editás el texto de cada mensaje: los 4 grupos más Bienvenida, Pago recibido y Aumento de precio.',
          'Variables que se reemplazan solas: [Nombre], [Plan], [Total], [Dias], [Vencimiento], [Alias] y [CBU]. Alias y CBU salen de Configuración.',
          'Al editar una plantilla tenés la opción de restablecer el texto original.',
        ],
      },
    ],
  },
  plataformas: {
    title: 'Cómo funciona Plataformas',
    intro: 'Es tu lista de precios: cada plataforma y combo con su precio. Desde acá hacés los aumentos y se los pasás a los clientes.',
    sections: [
      {
        title: 'Catálogo de plataformas',
        items: [
          'Cada fila muestra el precio y cuántos clientes la tienen. "N con otro precio" son los clientes que hoy pagan distinto del precio del catálogo.',
          'Las plataformas que ya usan tus clientes y no estaban cargadas aparecen solas, con el precio más común entre esos clientes.',
          'Con el lápiz cambiás nombre o precio. Si renombrás una plataforma, todos sus clientes pasan al nombre nuevo.',
          'Los cambios del catálogo (agregar, editar o borrar) se guardan solos.',
        ],
      },
      {
        title: 'Aumentos',
        items: [
          'Aumento general: ponés un % y sube el precio de todas las plataformas (no de los combos).',
          'También podés ajustar una sola plataforma por % desde su lápiz.',
          'Si cambia el precio de plataformas que forman parte de un combo, la app te ofrece ajustar el combo manteniendo el mismo descuento.',
        ],
      },
      {
        title: 'Combos',
        items: [
          'Juntan dos o más plataformas con un precio especial. Se muestra el % de descuento contra comprarlas por separado.',
          'Una plataforma puede ir más de una vez en el combo: tocala para agregarla y usá − / + para elegir cuántas cuentas (ej: Disney+ ×2 + YouTube Premium).',
          'Se asignan a los clientes como cualquier otro plan.',
        ],
      },
      {
        title: 'Pasar los precios a los clientes',
        items: [
          'Cambiar el catálogo NO cambia lo que pagan los clientes. Para eso está el botón "Aplicar precios a N clientes". A los clientes con varias plataformas se les pone la suma (precio × cantidad de cada una).',
          'La opción de no cambiar el importe a los clientes con nota de precio respeta los precios especiales.',
          'Después de aplicar podés tocar "Avisar el aumento por WhatsApp": abre una cola con la plantilla "Aumento de precio" para cada cliente afectado.',
        ],
      },
    ],
  },
  config: {
    title: 'Cómo funciona Configuración',
    intro: 'Los datos generales del sistema: cómo te pagan, quién entra a la app y la carga de clientes desde Excel.',
    sections: [
      {
        title: 'Datos de cobro',
        items: [
          'Tu alias y CBU/CVU. Se insertan en los mensajes donde la plantilla tenga [Alias] o [CBU].',
          'Si cambiás de cuenta, lo actualizás una sola vez acá y todos los mensajes salen con el dato nuevo.',
          'Mientras estén vacíos, el Dashboard y Mensajes muestran un aviso para que los cargues.',
        ],
      },
      {
        title: 'Accesos',
        items: [
          'Hay dos usuarios que comparten los mismos clientes, pagos y configuración: el administrador (fijo) y un usuario configurable.',
          'Del usuario configurable podés cambiar el mail y la contraseña.',
        ],
      },
      {
        title: 'Importar clientes desde Excel',
        items: [
          '1) Subí el archivo (.xlsx, .xls o .csv). La app busca sola la fila de títulos y adivina qué columna es cada dato.',
          '2) Revisá la asignación de columnas: cliente, teléfono, vencimiento y total son obligatorios (el teléfono no, si elegiste no importarlo).',
          '3) Revisá los cambios antes de confirmar: cuántos clientes son nuevos, cuáles se actualizan (con el detalle de qué cambia), cuáles quedan igual y cuáles están cargados pero no vienen en el archivo.',
          'Cada fila se cruza con tus clientes por celular (o por nombre) y se actualiza en lugar de duplicarse: se conservan notas, pagos e historial.',
          'Podés elegir no importar plataformas o teléfonos si vienen mal escritos en la planilla; los clientes existentes conservan los suyos. Si importás las plataformas, los códigos (NET, MAX…) se traducen solos.',
          'Los clientes que no vienen en el archivo solo se borran si tildás esa opción.',
        ],
      },
    ],
  },
};

/** Botón ⓘ con la explicación completa de la pantalla. */
const ModuleHelp = ({ module }: { module: HelpModule }) => {
  const [open, setOpen] = useState(false);
  const content = HELP[module];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo funciona esta pantalla"
        title="Cómo funciona esta pantalla"
        className="shrink-0 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-secondary transition-colors"
      >
        <Info size={22} />
      </button>

      {/* Se dibuja directo en <body>: dentro del encabezado animado quedaba por debajo del contenido */}
      {createPortal(
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/70 backdrop-blur-md animate-in-fade"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              role="dialog"
              aria-label={content.title}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-5 border-b border-border bg-secondary/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Info size={20} />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight truncate">{content.title}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar ayuda" className="p-2 rounded-full hover:bg-secondary transition-colors shrink-0">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <p className="text-sm text-muted-foreground leading-relaxed">{content.intro}</p>
                {content.sections.map(section => (
                  <section key={section.title} className="space-y-2">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">{section.title}</h3>
                    <ul className="space-y-2">
                      {section.items.map(item => (
                        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <div className="p-4 border-t border-border bg-slate-50">
                <button type="button" onClick={() => setOpen(false)} className="w-full h-12 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest">
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </>
  );
};

export default ModuleHelp;
