require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Columns in clients:', Object.keys(data[0] || {}));
  }
}

checkColumns();
