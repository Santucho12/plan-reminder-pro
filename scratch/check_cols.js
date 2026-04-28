
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://strtpvosygwhtmqpvdah.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cnRwdm9zeWd3aHRtcXB2ZGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODcyNTQsImV4cCI6MjA4OTE2MzI1NH0.0YlrOma0G1OOpTFAsY-MlvQ8g9o6uv6skAfLlL8rPDQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Testing insert for project: strtpvosygwhtmqpvdah');
    const { data, error } = await supabase
        .from('clients')
        .insert({
            nombre: 'Test Notes',
            celular: '123456',
            vencimiento: '2026-12-31',
            total: 100,
            estado: 'pendiente',
            user_id: '9671320f-385c-4462-b33b-decee9cc221c', // Usando el ID que aparece en el error del user
            nota_plataforma: 'Test note'
        })
        .select();
    
    if (error) {
        console.error('Insert Error Detail:', JSON.stringify(error, null, 2));
    } else {
        console.log('Insert Success! Result:', data);
    }
}

testInsert();
