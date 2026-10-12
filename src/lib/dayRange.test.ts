import { describe, it, expect } from 'vitest';
import { describeDayRange, inDayRange, parseDayRange } from '@/lib/dayRange';

describe('rango de días al vencimiento', () => {
  it('incluye los dos extremos', () => {
    const range = parseDayRange('-7', '-3');
    expect([-8, -7, -5, -3, -2].map(d => inDayRange(d, range))).toEqual([false, true, true, true, false]);
  });

  it('si se escribe al revés lo ordena solo', () => {
    expect(parseDayRange('-3', '-7')).toEqual({ min: -7, max: -3 });
  });

  it('un lado vacío no tiene límite', () => {
    const range = parseDayRange('-7', '');
    expect(inDayRange(-7, range)).toBe(true);
    expect(inDayRange(400, range)).toBe(true);
    expect(inDayRange(-8, range)).toBe(false);
    expect(parseDayRange('', '-')).toEqual({ min: null, max: null });
  });

  it('describe el rango en palabras y con fechas', () => {
    const today = new Date(2026, 9, 12);
    expect(describeDayRange(parseDayRange('-7', '-3'), today)).toBe('Vencen entre el 05/10 (hace 7 días) y el 09/10 (hace 3 días)');
    expect(describeDayRange(parseDayRange('0', '1'), today)).toBe('Vencen entre hoy (12/10) y el 13/10 (en 1 día)');
    expect(describeDayRange(parseDayRange('5', ''), today)).toBe('Vencen desde el 17/10 (en 5 días) en adelante');
    expect(describeDayRange(parseDayRange('', '-30'), today)).toBe('Vencen hasta el 12/09 (hace 30 días)');
    expect(describeDayRange(parseDayRange('-1', '-1'), today)).toBe('Vencen el 11/10 (hace 1 día)');
    expect(describeDayRange(parseDayRange('', ''), today)).toBe('Escribí un rango de días');
  });
});
