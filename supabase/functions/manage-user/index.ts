// Cambia el mail y/o la contraseña del usuario configurable del workspace
// (y guarda una copia legible de la contraseña en app_members.clave para mostrarla en la app).
// El admin es fijo: esta función nunca lo modifica.
// Lo puede llamar cualquier miembro del workspace (el admin o el propio usuario configurable).
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Quién llama: se valida el token de su sesión
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return json({ error: 'Sesión inválida' }, 401);

  const { data: me } = await admin.from('app_members').select('workspace_id').eq('user_id', caller.id).maybeSingle();
  if (!me) return json({ error: 'Tu usuario no tiene acceso a este sistema' }, 403);

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Datos inválidos' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email && !password) return json({ error: 'Indicá un mail o una contraseña nueva' }, 400);
  if (email && !EMAIL_PATTERN.test(email)) return json({ error: 'El mail no es válido' }, 400);
  if (password && password.length < MIN_PASSWORD) return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` }, 400);

  const { data: target } = await admin
    .from('app_members')
    .select('user_id')
    .eq('workspace_id', me.workspace_id)
    .eq('rol', 'usuario')
    .maybeSingle();
  if (!target) return json({ error: 'No hay usuario configurable en este sistema' }, 404);

  const { data, error } = await admin.auth.admin.updateUserById(target.user_id, {
    ...(email ? { email, email_confirm: true } : {}),
    ...(password ? { password } : {}),
  });
  if (error) {
    const taken = /already|registered|exists/i.test(error.message);
    return json({ error: taken ? 'Ese mail ya está en uso' : error.message }, taken ? 409 : 400);
  }

  // Copia legible para mostrarla en Configuración (Auth solo guarda el hash)
  if (password) {
    const { error: claveError } = await admin.from('app_members').update({ clave: password }).eq('user_id', target.user_id);
    if (claveError) console.error('No se pudo guardar la copia de la contraseña:', claveError.message);
  }

  return json({ email: data.user?.email });
});
