
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spdyopkrocccpgeigsyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MTUzMCwiZXhwIjoyMDg1MjY3NTMwfQ.J_EaQ3vGb7X-geUl8o08r-EgaxltEboRBoMmUQFxtqo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error('Error listing users:', error);
            return;
        }
        console.log('Total users:', users.length);
        if (users?.length > 0) {
            users.forEach(u => console.log('ID:', u.id, 'Email:', u.email));
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkUsers();
