
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spdyopkrocccpgeigsyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MTUzMCwiZXhwIjoyMDg1MjY3NTMwfQ.J_EaQ3vGb7X-geUl8o08r-EgaxltEboRBoMmUQFxtqo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSync() {
    const { data: { users } } = await supabase.auth.admin.listUsers();
    console.log('--- AUTH USERS ---');
    users.forEach(u => console.log('ID:', u.id, 'Email:', u.email));

    const { data: publicUsers } = await supabase.from('users').select('*');
    console.log('--- PUBLIC USERS (Table) ---');
    console.log(publicUsers);

    // Intentar insertar en clients con el nuevo ID para ver el error exacto OTRA VEZ
    // Pero ahora imprimiremos el error COMPLETO
    const userId = '9732679a-ab89-4f99-bc40-4089e69d8b71';
    const { error: insertError } = await supabase.from('clients').insert({
        user_id: userId,
        nombre: 'TEST SAVE',
        celular: '123',
        vencimiento: '2026-03-20',
        total: 10,
        estado: 'pendiente',
        dias: 0
    });
    
    if (insertError) {
        console.error('--- INSERT ERROR DETAIL ---');
        console.error(insertError);
    } else {
        console.log('Insert succeed on manual test!');
    }
}

checkSync();
