import { supabase } from '@/integrations/supabase/client';
import { ColumnMapping } from '@/types/client';
import { differenceInDays, startOfDay, addDays } from 'date-fns';

const cleanPhone = (phone: any) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  // Si tiene 10 dígitos y empieza con 11 (Baires), es 54911...
  if (cleaned.length === 10 && cleaned.startsWith('11')) return `549${cleaned}`;
  // En general para Argentina si tiene 10 dígitos le ponemos 54
  if (cleaned.length === 10) return `54${cleaned}`;
  return cleaned;
};

export async function insertClientsFromExcel(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  userId: string
) {
  // Limpiar clientes anteriores para empezar de cero con el nuevo Excel
  await supabase.from('clients').delete().eq('user_id', userId);

  // Filtrar filas vacías (donde el nombre esté vacío)
  const validRows = rows.filter(row => row[mapping.nombre] && row[mapping.nombre].trim() !== '');

  const clients = validRows.map((row) => {
    const vencimientoStr = row[mapping.vencimiento]?.trim();
    let vencimiento: string;

    // Intentar parsear fecha asumiendo formato DD/MM/YYYY primero si contiene barras
    if (vencimientoStr.includes('/') || vencimientoStr.includes('-')) {
      const parts = vencimientoStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        // Asume DD/MM/YYYY si el primer campo es <= 31 y el tercero es un año (4 dígitos o > 31)
        const d_idx = parts[0].length <= 2 && Number(parts[0]) <= 31 ? 0 : 2;
        const m_idx = 1;
        const y_idx = d_idx === 0 ? 2 : 0;
        
        const day = Number(parts[d_idx]);
        const month = Number(parts[m_idx]) - 1;
        let year = Number(parts[y_idx]);
        if (year < 100) year += 2000;

        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          vencimiento = d.toISOString().split('T')[0];
        } else {
          vencimiento = new Date().toISOString().split('T')[0];
        }
      } else {
        const parsed = new Date(vencimientoStr);
        vencimiento = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      }
    } else {
      const parsed = new Date(vencimientoStr);
      vencimiento = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    }

    const today = startOfDay(new Date());
    const vDate = startOfDay(new Date(vencimiento));
    const diffDays = differenceInDays(vDate, today);

    // Lógica corregida: Todo nuevo es 'pendiente' por defecto. 
    // Solo marcamos 'vencido' si la fecha ya pasó.
    // NUNCA marcamos 'pagado' automáticamente porque no sabemos si pagó el periodo que vence.
    let estado: 'pendiente' | 'vencido' = 'pendiente';
    if (diffDays < 0) estado = 'vencido';

    const celular = cleanPhone(row[mapping.celular]);

    return {
      id: crypto.randomUUID(), // Generamos UUID siempre para evitar error de clave duplicada
      user_id: userId,
      nombre: row[mapping.nombre] || 'Sin Nombre',
      celular: celular || '',
      plan: row[mapping.plan] || '',
      vencimiento,
      total: parseFloat(String(row[mapping.total] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
      estado,
      alertas: row[mapping.alertas] || '',
      dias: row[mapping.dias] || '',
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

export async function triggerReminders(userId: string) {
  const { data, error } = await supabase.functions.invoke('send-reminders', {
    body: { userId }
  });
  if (error) throw error;
  return data;
}

export async function fetchUserConfig(userId: string) {
  const { data, error } = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateUserConfig(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('user_configs')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
