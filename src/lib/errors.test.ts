import { describe, it, expect } from 'vitest';
import { userMessage } from '@/lib/errors';

describe('userMessage', () => {
  it('muestra tal cual los mensajes que arma la app', () => {
    expect(userMessage(new Error('Ese mail ya está en uso'), 'No se pudo')).toBe('Ese mail ya está en uso');
  });

  it('reemplaza los errores técnicos de la base por el texto indicado', () => {
    const postgres = { code: '42501', message: 'new row violates row-level security policy' };
    expect(userMessage(postgres, 'No se pudo registrar el pago')).toBe('No se pudo registrar el pago');
  });

  it('avisa en español cuando no hay conexión', () => {
    expect(userMessage(new TypeError('Failed to fetch'), 'x')).toBe('No se pudo conectar. Revisá tu conexión a internet.');
  });

  it('sin mensaje usa el texto indicado', () => {
    expect(userMessage(undefined, 'No se pudo guardar')).toBe('No se pudo guardar');
  });
});
