import { format, subDays } from 'date-fns';
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEMPLATES,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  getSegment,
  isCobroEmpty,
  parseSettings,
  renderTemplate,
  serializeSettings,
} from '@/lib/whatsapp';
import { makeClient } from '@/test/fakeSupabase';

describe('getSegment', () => {
  it.each([
    [0, 'today'],
    [1, 'soon'],
    [2, 'soon'],
    [3, 'soon'],
    [-1, 'expired'],
    [-30, 'expired'],
    [-31, 'lost'],
    [-400, 'lost'],
    [4, null],
    [60, null],
  ])('días %i -> %s', (dias, expected) => {
    expect(getSegment(makeClient({ dias }))).toBe(expected);
  });

  it('acepta días como texto (así llegan desde la base)', () => {
    expect(getSegment(makeClient({ dias: '-5' as any }))).toBe('expired');
  });

  it('no asigna segmento a los clientes en "no molestar" o dados de baja', () => {
    expect(getSegment(makeClient({ dias: 0, seguimiento: 'no_molestar' }))).toBeNull();
    expect(getSegment(makeClient({ dias: -10, seguimiento: 'baja' }))).toBeNull();
    expect(getSegment(makeClient({ dias: -10, seguimiento: 'prometio_pago' }))).toBe('expired');
  });

  it('sin días calculables no asigna segmento', () => {
    expect(getSegment({ ...makeClient(), dias: undefined })).toBeNull();
    expect(getSegment(makeClient({ dias: 'abc' as any }))).toBeNull();
  });
});

describe('renderTemplate', () => {
  it('reemplaza todas las variables con los datos del cliente', () => {
    const client = makeClient({ nombre: 'Ana', plan: 'Spotify', total: 15000, dias: 2 });
    expect(renderTemplate('[Nombre] / [Plan] / [Total] / [Dias] / [Nombre]', client)).toBe('Ana / Spotify / 15.000 / 2 / Ana');
  });

  it('muestra los días vencidos en positivo', () => {
    expect(renderTemplate('hace [Dias] días', makeClient({ dias: -7 }))).toBe('hace 7 días');
  });

  it('reemplaza el vencimiento y los datos de cobro configurados', () => {
    const client = makeClient({ vencimiento: new Date(2026, 2, 6) });
    const cobro = { alias: 'mi.alias', cbu: '123' };
    expect(renderTemplate('[Vencimiento] | [Alias] | [CBU]', client, cobro)).toBe('06/03/2026 | mi.alias | 123');
  });

  it('deja intacto el texto sin variables', () => {
    expect(renderTemplate('Hola [Otra] cosa', makeClient())).toBe('Hola [Otra] cosa');
  });
});

describe('buildWhatsAppMessage', () => {
  it('"Próximos 3 días": de 1 a 3 días, salvo que ya se le haya avisado en ese período', () => {
    const vence = (dias: number) => makeClient({ dias });
    const conAviso = (dias: number, haceDias: number) => ({ ...vence(dias), ultimoMensaje: subDays(new Date(), haceDias) });

    // Avisado ayer estando a 3 días: hoy (a 2) ya no aparece
    expect(getSegment(conAviso(2, 1))).toBeNull();
    // Avisado hoy: sigue en la lista, marcado como enviado
    expect(getSegment(conAviso(2, 0))).toBe('soon');
    // El último aviso fue antes de entrar en la ventana (el ciclo anterior): aparece
    expect(getSegment(conAviso(2, 10))).toBe('soon');
    // Si un día no se abrió la app, al siguiente sigue apareciendo
    expect(getSegment(vence(1))).toBe('soon');
  });

  it('usa la plantilla del segmento del cliente', () => {
    expect(buildWhatsAppMessage(makeClient({ dias: 0 }))).toContain('hoy vence tu suscripción');
    // El recordatorio dice la fecha real: sirve igual a 1, 2 o 3 días
    const pronto = makeClient({ dias: 2 });
    expect(buildWhatsAppMessage(pronto)).toContain(`el ${format(pronto.vencimiento, 'dd/MM/yyyy')} vence tu suscripción`);
    expect(buildWhatsAppMessage(makeClient({ dias: -10 }))).toContain('ya está vencida');
    expect(buildWhatsAppMessage(makeClient({ dias: -45 }))).toContain('10% de descuento');
  });

  it('incluye el total formateado y los datos de pago en los recordatorios', () => {
    const message = buildWhatsAppMessage(makeClient({ dias: 0, total: 15000 }));
    expect(message).toContain('💰 15.000');
    expect(message).not.toContain('[Total]');
    expect(message).not.toContain('[CBU]');
    expect(message).not.toContain('undefined');
  });

  it('con más de 3 días usa el recordatorio estándar', () => {
    expect(buildWhatsAppMessage(makeClient({ dias: 20 }))).toContain('¿Vas a querer renovar?');
  });

  it('los datos de cobro configurados reemplazan a los predeterminados', () => {
    const message = buildWhatsAppMessage(makeClient({ dias: 0 }), DEFAULT_TEMPLATES, { alias: 'otro.alias', cbu: '999' });
    expect(message).toContain('cbu : 999');
    expect(message).toContain('y alias : otro.alias');
  });

  it('puede forzar una plantilla que no depende del vencimiento', () => {
    const client = makeClient({ nombre: 'Ana', plan: 'HBO', dias: 20 });
    expect(buildWhatsAppMessage(client, DEFAULT_TEMPLATES, undefined, 'welcome')).toContain('Ya quedó activo tu plan HBO');
  });

  it('usa las plantillas editadas por el usuario', () => {
    const templates = { ...DEFAULT_TEMPLATES, expired: 'Hola [Nombre], debés [Total]' };
    expect(buildWhatsAppMessage(makeClient({ dias: -3, nombre: 'Ana', total: 2500 }), templates)).toBe('Hola Ana, debés 2.500');
  });
});

describe('buildWhatsAppUrl', () => {
  it('arma el link wa.me con el número y el mensaje codificado', () => {
    const url = buildWhatsAppUrl(makeClient({ celular: '5492915371541' }), 'Hola ⚠️\n¿Renovás? 100%')!;
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://wa.me/5492915371541');
    expect(parsed.searchParams.get('text')).toBe('Hola ⚠️\n¿Renovás? 100%');
  });

  it('normaliza números argentinos sin código de país', () => {
    expect(buildWhatsAppUrl(makeClient({ celular: '291 537-1541' }), 'x')).toContain('wa.me/5492915371541?');
  });

  it('devuelve null si el cliente no tiene un número usable', () => {
    expect(buildWhatsAppUrl(makeClient({ celular: '' }), 'x')).toBeNull();
    expect(buildWhatsAppUrl(makeClient({ celular: 'sin datos' }), 'x')).toBeNull();
    expect(buildWhatsAppUrl(makeClient({ celular: '12345' }), 'x')).toBeNull();
  });
});

describe('plantillas guardadas', () => {
  it('serializar y volver a leer conserva las ediciones', () => {
    const edited = { ...DEFAULT_TEMPLATES, today: 'Hoy vence, [Nombre]' };
    expect(parseSettings(serializeSettings({ ...parseSettings(null), templates: edited })).templates).toEqual(edited);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['texto viejo de la automatización', 'Hola [Nombre], pagá en [Link Mercado Pago]'],
    ['JSON ajeno', '{"foo":1}'],
    ['JSON de otra versión', '{"version":2,"templates":{"today":"x"}}'],
  ])('con %s usa las predeterminadas', (_label, raw) => {
    expect(parseSettings(raw).templates).toEqual(DEFAULT_TEMPLATES);
  });

  it('completa con las predeterminadas lo que falte o esté vacío', () => {
    const raw = JSON.stringify({ version: 1, templates: { today: 'Editado', soon: '   ', lost: 42 } });
    expect(parseSettings(raw).templates).toEqual({ ...DEFAULT_TEMPLATES, today: 'Editado' });
  });

  it('no modifica el objeto de plantillas predeterminadas', () => {
    const parsed = parseSettings(null).templates;
    parsed.today = 'cambiado';
    expect(DEFAULT_TEMPLATES.today).toContain('hoy vence');
  });
});

describe('configuración guardada', () => {
  it('guarda juntas plantillas, datos de cobro y catálogo', () => {
    const settings = parseSettings(null);
    settings.templates.paid = 'Gracias [Nombre]';
    settings.cobro = { alias: 'a', cbu: 'b' };
    settings.planes = [{ nombre: 'Netflix', precio: 1500 }];

    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });

  it('una configuración vieja (texto con solo plantillas) deja los datos de cobro vacíos', () => {
    const old = JSON.stringify({ version: 1, templates: { ...DEFAULT_TEMPLATES, today: 'Editada' } });
    const settings = parseSettings(old);
    expect(settings.templates.today).toBe('Editada');
    expect(settings.cobro).toEqual({ alias: '', cbu: '' });
    expect(isCobroEmpty(settings.cobro)).toBe(true);
    expect(settings.planes).toEqual([]);
  });

  it('lee la configuración guardada como objeto (columna jsonb)', () => {
    const settings = parseSettings({ version: 1, cobro: { alias: 'mi.alias' } });
    expect(settings.cobro).toEqual({ alias: 'mi.alias', cbu: '' });
    expect(isCobroEmpty(settings.cobro)).toBe(false);
  });

  it('conserva los combos con sus plataformas', () => {
    const raw = JSON.stringify({ version: 1, planes: [{ nombre: 'Pack', precio: 1200, plataformas: ['Netflix', 'HBO'] }, { nombre: 'Uno', precio: 1, plataformas: ['Netflix'] }] });
    expect(parseSettings(raw).planes).toEqual([{ nombre: 'Pack', precio: 1200, plataformas: ['Netflix', 'HBO'] }, { nombre: 'Uno', precio: 1 }]);
  });

  it('descarta planes mal formados', () => {
    const raw = JSON.stringify({ version: 1, planes: [{ nombre: ' HBO ', precio: '900' }, { nombre: '', precio: 1 }, { nombre: 'X', precio: 'caro' }, null] });
    expect(parseSettings(raw).planes).toEqual([{ nombre: 'HBO', precio: 900 }]);
  });
});
