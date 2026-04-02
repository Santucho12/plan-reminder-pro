// Script para crear usuario en Supabase Auth
// Uso: node create_user.js
// IMPORTANTE: Necesitás la SERVICE_ROLE_KEY (no la anon key)

const SUPABASE_URL = "https://spdyopkrocccpgeigsyb.supabase.co";

// Reemplazá esto con tu service_role key del dashboard de Supabase
// Settings → API → service_role (secret)
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "TU_SERVICE_ROLE_KEY_ACA";

const EMAIL = "fiesta@gmail.com";
const PASSWORD = "123456"; // Cambiá la contraseña que quieras

async function createUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // Auto-confirmar
    }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log("✅ Usuario creado exitosamente:", data.email);
    console.log("   ID:", data.id);
  } else {
    console.error("❌ Error:", data.msg || data.message || JSON.stringify(data));
  }
}

createUser();
