const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../bot-whatsapp/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = process.env.USER_ID;

async function checkClients() {
  console.log(`Checking clients for User: ${userId}`);
  
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId);
    
  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }
  
  console.log(`Found ${clients.length} clients.`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  clients.forEach(client => {
    if (!client.vencimiento) {
      console.log(`Client ${client.nombre} has no expiration date.`);
      return;
    }
    
    const vencDate = new Date(`${client.vencimiento}T00:00:00`);
    const diffTime = vencDate.getTime() - today.getTime();
    const diasNum = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    console.log(`Client ${client.nombre}: Vencimiento ${client.vencimiento} - Dias: ${diasNum} - Estado: ${client.estado}`);
    
    if ((diasNum >= 0 && diasNum <= 3) || diasNum < 0) {
      console.log(` -> Needs reminder or is expired.`);
    }
  });

  // Check messages log
  const { data: messages, error: mErr } = await supabase
    .from('messages_log')
    .select('*')
    .eq('user_id', userId)
    .eq('enviado', false);
    
  console.log(`Unsent messages in log: ${messages?.length || 0}`);
}

checkClients();
