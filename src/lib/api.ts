import { supabase } from '@/integrations/supabase/client';
import { ColumnMapping } from '@/types/client';
import { differenceInDays, startOfDay } from 'date-fns';

export async function insertClientsFromExcel(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  userId: string
) {
  const clients = rows.map((row) => {
    const vencimientoStr = row[mapping.vencimiento];
    let vencimiento: string;

    const parsed = new Date(vencimientoStr);
    if (!isNaN(parsed.getTime())) {
      vencimiento = parsed.toISOString().split('T')[0];
    } else {
      const parts = vencimientoStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        vencimiento = d.toISOString().split('T')[0];
      } else {
        vencimiento = new Date().toISOString().split('T')[0];
      }
    }

    const today = startOfDay(new Date());
    const vDate = startOfDay(new Date(vencimiento));
    const diffDays = differenceInDays(vDate, today);

    let estado = 'pendiente';
    if (diffDays < 0) estado = 'vencido';
    else if (diffDays > 3) estado = 'pagado';

    return {
      user_id: userId,
      nombre: row[mapping.nombre] || '',
      apellido: row[mapping.apellido] || '',
      celular: row[mapping.celular] || '',
      plan: row[mapping.plan] || '',
      vencimiento,
      total: parseFloat(row[mapping.total]?.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
      estado,
    };
  });

  const { data, error } = await supabase.from('clients').insert(clients).select();
  if (error) throw error;
  return data;
}

export async function fetchClients(userId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('vencimiento', { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchMessagesLog(userId: string) {
  const { data, error } = await supabase
    .from('messages_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function deleteClient(clientId: string) {
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw error;
}

export async function triggerReminders() {
  const { data, error } = await supabase.functions.invoke('send-reminders');
  if (error) throw error;
  return data;
}
