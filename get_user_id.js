
const supabaseUrl = 'https://spdyopkrocccpgeigsyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MTUzMCwiZXhwIjoyMDg1MjY3NTMwfQ.J_EaQ3vGb7X-geUl8o08r-EgaxltEboRBoMmUQFxtqo';

async function getUserId() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/messages_log?select=user_id&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        
        if (data && data.length > 0) {
            console.log('USER_ID:', data[0].user_id);
        } else {
            console.error('No data in messages_log, trying clients...');
            const resp2 = await fetch(`${supabaseUrl}/rest/v1/clients?select=user_id&limit=1`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            const data2 = await resp2.json();
            if (data2 && data2.length > 0) {
                console.log('USER_ID:', data2[0].user_id);
            } else {
                console.error('No user_id found in clients either.');
            }
        }
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

getUserId();
