
async function testFunction() {
    const url = 'https://spdyopkrocccpgeigsyb.supabase.co/functions/v1/send-reminders';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZHlvcGtyb2NjY3BnZWlnc3liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE1MzAsImV4cCI6MjA4NTI2NzUzMH0.VUufrvUSIR8A5WU4zvRIdtoIk7pSTaE0EyuU_TakIho';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`,
                'apikey': anonKey
            },
            body: JSON.stringify({
                userId: '9732679a-ab89-4f99-bc40-4089e69d8b71',
                mode: 'regular'
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

testFunction();
