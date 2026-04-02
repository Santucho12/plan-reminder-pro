import { supabase } from '@/integrations/supabase/client';
import { ColumnMapping } from '@/types/client';
import { differenceInDays, startOfDay, addDays } from 'date-fns';

export const cleanPhone = (phone: any) => {
  if (!phone) return null;
  // Limpiar todo lo que no sea número
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Caso Argentina: Número local de 10 dígitos (ej: 2915371541)
  // WhatsApp requiere 54 + 9 + cod_area + numero
  if (cleaned.length === 10) {
    return `549${cleaned}`;
  }

  // Caso Argentina: Ya tiene el 54 pero le falta el 9 (ej: 542915371541 tiene 12 dígitos)
  if (cleaned.length === 12 && cleaned.startsWith('54')) {
    return `549${cleaned.substring(2)}`;
  }

  // Si ya tiene 13 dígitos y empieza con 549, está perfecto
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
    const vencimientoStr = String(row[mapping.vencimiento] || '').trim();
    let vencimientoDate = new Date();

    // Función interna para parsear cualquier formato de Excel
    const parseExcelDate = (str: string) => {
      // Si es un número de serie de Excel (ej: 46101 para 16-Mar-2026)
      const serial = Number(str);
      if (!isNaN(serial) && serial > 10000 && serial < 100000) {
        const utcDate = new Date(Date.UTC(1900, 0, serial - 1));
        return utcDate;
      }
      
      if (str.includes('/') || str.includes('-')) {
        const parts = str.split(/[\/\-\.]/).map(p => Number(p));
        if (parts.length === 3) {
          let y = parts.find(p => p > 31) || parts[2];
          let year = y < 100 ? 2000 + y : y;
          
          let p1 = parts[0], p2 = parts[1];
          let day = p1, month = p2;

          if (p1 > 12) {
             // 16/03/2026 -> p1 es el día
             day = p1; month = p2;
          } else if (p2 > 12) {
             // 03/16/2026 -> p2 es el día
             day = p2; month = p1;
          } else {
             // 06/07/2026 -> asumimos formato argentino DD/MM/YYYY
             day = p1; month = p2;
          }

          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime())) return d;
        }
      }

      const fallback = new Date(str);
      return !isNaN(fallback.getTime()) ? fallback : new Date();
    };

    if (vencimientoStr) {
      vencimientoDate = parseExcelDate(vencimientoStr);
    }
    
    // Convertir a string ISO respetando el día exacto
    const vencimiento = vencimientoDate.toISOString().split('T')[0];

    // Nueva lógica: El campo 'estado' guardará el texto exacto de la columna 'Alertas' del Excel
    const mappingKey = mapping.alertas || 'alertas';
    const rawAlerta = row[mappingKey] || row['Alertas'] || row['alertas'] || '';
    
    // Si viene vacío del Excel, el estado será 'Pendiente' por defecto
    const estado = 'pendiente';

    const celular = cleanPhone(row[mapping.celular]);

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      nombre: row[mapping.nombre] || 'Sin Nombre',
      celular: celular || '',
      plan: row[mapping.plan] || '',
      vencimiento,
      total: parseFloat(String(row[mapping.total] || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0,
      estado,
      dias: Number(row[mapping.dias]) || 0,
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
  
  const today = startOfDay(new Date());

  // Instanciar como Date local al mediodía para evitar desfases de zona horaria (UTC-3).
  // Y calcular DÍAS dinámicamente.
  return data.map((client: any) => {
    const vDate = new Date(`${client.vencimiento}T12:00:00`);
    const diff = differenceInDays(startOfDay(vDate), today);
    
    // Normalizar estado basado en los días calculados
    let estadoActual = client.estado;
    const upper = String(client.estado).toUpperCase();
    
    // Solo sobreescribir si no es un estado final (Pagado)
    if (!upper.includes('PAGADO')) {
      if (diff === 0) estadoActual = 'Vence hoy';
      else if (diff > 0 && diff <= 3) estadoActual = 'Por vencer';
      else if (diff < 0) estadoActual = 'Vencido';
      else if (diff > 3) estadoActual = 'Activo';
    }

    return {
      ...client,
      vencimiento: vDate,
      dias: diff.toString(),
      estado: estadoActual
    };
  });
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

export async function updateClient(clientId: string, updates: any) {
  const finalUpdates = { ...updates };
  if (finalUpdates.celular) {
    finalUpdates.celular = cleanPhone(finalUpdates.celular);
  }

  const { data, error } = await supabase
    .from('clients')
    .update(finalUpdates)
    .eq('id', clientId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createClient(userId: string, clientData: any) {
  const finalData = { ...clientData };
  if (finalData.celular) {
    finalData.celular = cleanPhone(finalData.celular);
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({ 
      ...finalData, 
      id: crypto.randomUUID(),
      user_id: userId, 
      dias: finalData.dias || 0 
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function triggerReminders(userId: string, mode: 'regular' | 'expired' | 'lost' = 'regular') {
  const { data, error } = await supabase.functions.invoke('send-reminders', {
    body: { userId, origin: window.location.origin, mode },
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    }
  });
  if (error) throw error;
  return data;
}

export async function fetchUserConfig(userId: string) {
  const { data, error } = await supabase
    .from('user_configs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) throw error;
  return data;
}

export async function updateUserConfig(userId: string, updates: any) {
  const { data, error } = await supabase
    .from('user_configs')
    .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .maybeSingle();
  
  if (error) throw error;
  return data;
}
