
const supabaseUrl = 'https://spdyopkrocccpgeigsyb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5MTUzMCwiZXhwIjoyMDg1MjY3NTMwfQ.J_EaQ3vGb7X-geUl8o08r-EgaxltEboRBoMmUQFxtqo';

async function checkConfigs() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/user_configs?select=user_id,wpp_status`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        console.log('Configs:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

checkConfigs();
