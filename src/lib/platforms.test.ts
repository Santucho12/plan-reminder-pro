import { describe, it, expect } from 'vitest';
import { parsePlatforms } from '@/lib/platforms';

describe('parsePlatforms', () => {
  it.each([
    // Una plataforma, con los espacios de más que trae la planilla
    ['NET', 'Netflix', ''],
    ['SUFF   ', 'SUFF', ''],
    ['FLUJO ', 'FLUJO', ''],
    // Combos: el orden en que se escribió no cambia el nombre
    ['NET+MAX', 'Netflix + Max', ''],
    ['MAX+NET', 'Netflix + Max', ''],
    ['AMZ +MAX', 'Max + Amazon Prime Video', ''],
    ['NET + SPOT', 'Netflix + Spotify', ''],
    ['MAX+AMZ+CRUN+PARA', 'Max + Amazon Prime Video + Paramount+ + Crunchyroll', ''],
    // Cantidad de cuentas
    ['NET 2', 'Netflix x2', ''],
    ['SUFF  2', 'SUFF x2', ''],
    ['CRUN x2 no anote en ninguna cuenta creo, ir viendo eso', 'Crunchyroll x2', 'no anote en ninguna cuenta creo, ir viendo eso'],
    ['NET 2  + AMZ+MAX   ', 'Netflix x2 + Max + Amazon Prime Video', ''],
    ['MAX+PARA+SPOT+CRUN 2 + AMZ 2', 'Max + Amazon Prime Video x2 + Paramount+ + Spotify + Crunchyroll x2', ''],
    // Notas: nombres, cobros, bajas
    ['NET 2 (uno de sandra teves)', 'Netflix x2', '(uno de sandra teves)'],
    ['MAX 2 (pablo) + NET 2 + DIS + AMZ', 'Netflix x2 + Disney+ + Max x2 + Amazon Prime Video', '(pablo)'],
    ['SUFF     EL 15/10 cobrar 9K', 'SUFF', 'EL 15/10 cobrar 9K'],
    ['SUFF+NET+AMZ  ya pago, el 10/10 estirar suff', 'Netflix + Amazon Prime Video + SUFF', 'ya pago, el 10/10 estirar suff'],
    ['NET+DIS   baja dis', 'Netflix + Disney+', 'baja dis'],
    ['SUFF prifede1  ', 'SUFF', 'prifede1'],
    ['SPOT (NR)', 'Spotify', '(NR)'],
  ])('%j → %j', (raw, plan, nota) => {
    expect(parsePlatforms(raw)).toEqual({ plan, nota });
  });

  it('lo que no tiene ningún código conocido se deja como estaba', () => {
    expect(parsePlatforms('  Youtube   Premium ')).toEqual({ plan: 'Youtube Premium', nota: '' });
    expect(parsePlatforms('')).toEqual({ plan: '', nota: '' });
    expect(parsePlatforms(undefined)).toEqual({ plan: '', nota: '' });
  });

  it('no confunde un nombre que empieza igual que un código', () => {
    expect(parsePlatforms('Spotify Family')).toEqual({ plan: 'Spotify Family', nota: '' });
  });
});
