/**
 * Mensaje para mostrarle al usuario. Los errores que arma la app ya están en español y se muestran tal
 * cual; los de la base o la red (en inglés y técnicos) se reemplazan por el texto que se indique.
 */
export function userMessage(error: any, fallback: string): string {
  const message = String(error?.message ?? '');
  if (/failed to fetch|network ?error|load failed/i.test(message)) return 'No se pudo conectar. Revisá tu conexión a internet.';
  if (error?.code !== undefined || !message) return fallback;
  return message;
}
