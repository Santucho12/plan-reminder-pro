import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EffectiveWppStatus, getEffectiveWppStatus } from '@/lib/wppStatus';

export function useWhatsAppStatus(userId: string | undefined) {
  const [wppStatus, setWppStatus] = useState<EffectiveWppStatus>('disconnected');

  useEffect(() => {
    if (!userId) return;

    const checkStatus = async () => {
      const { data } = await supabase
        .from('user_configs')
        .select('wpp_status, wpp_last_heartbeat')
        .eq('user_id', userId)
        .maybeSingle();

      if (!data) {
        setWppStatus('disconnected');
        return;
      }

      setWppStatus(
        getEffectiveWppStatus(data.wpp_status, data.wpp_last_heartbeat),
      );
    };

    checkStatus();
    const interval = setInterval(checkStatus, 20_000);

    const channel = supabase
      .channel(`wpp-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_configs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            wpp_status?: string;
            wpp_last_heartbeat?: string;
          };
          setWppStatus(
            getEffectiveWppStatus(row.wpp_status, row.wpp_last_heartbeat),
          );
        },
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return wppStatus;
}
