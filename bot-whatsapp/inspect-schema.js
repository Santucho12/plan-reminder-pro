require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'clients' });
  
  if (error) {
    // If RPC doesn't exist, try querying directly if allowed (usually not)
    console.log('RPC failed, trying direct query on information_schema...');
    const { data: cols, error: colError } = await supabase.from('clients').select('*').limit(1);
    if (colError) console.error(colError);
    else console.log('Columns:', Object.keys(cols[0] || {}));
  } else {
    console.log(data);
  }
}

inspectSchema();
