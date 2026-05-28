export type EffectiveWppStatus = 'connected' | 'disconnected' | 'connecting' | 'pending_qr';

/** El bot envía heartbeat cada 20s; si pasan 2 min sin señal, se considera desconectado. */
export const HEARTBEAT_STALE_MS = 120_000;

export function getEffectiveWppStatus(
  wppStatus?: string | null,
  wppLastHeartbeat?: string | null,
): EffectiveWppStatus {
  if (wppStatus === 'pending_qr') return 'pending_qr';
  if (wppStatus === 'connecting') return 'connecting';

  if (wppStatus === 'connected') {
    if (!wppLastHeartbeat) return 'connecting';
    const lastBeat = new Date(wppLastHeartbeat).getTime();
    if (Number.isNaN(lastBeat) || Date.now() - lastBeat > HEARTBEAT_STALE_MS) {
      return 'disconnected';
    }
    return 'connected';
  }

  return 'disconnected';
}
