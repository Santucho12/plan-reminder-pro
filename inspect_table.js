
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spdyopkrocccpgeigsyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MTUzMCwiZXhwIjoyMDg1MjY3NTMwfQ.J_EaQ3vGb7X-geUl8o08r-EgaxltEboRBoMmUQFxtqo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
    // Inserta un cliente dummy para ver si falla y por qué (con service_role vemos el error real)
    const userId = '9732679a-ab89-4f99-bc40-4089e69d8b71';
    const { data, error } = await supabase
        .from('clients')
        .insert({
            user_id: userId,
            nombre: 'Test',
            celular: '123',
            vencimiento: '2026-03-20',
            total: 100,
            estado: 'pendiente'
        })
        .select()
        .single();
    
    if (error) {
        console.error('Insert Error Detail:', error);
    } else {
        console.log('Insert Success! Columns:', Object.keys(data));
    }
}

inspectTable();
