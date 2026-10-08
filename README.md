# FiestaCobra

Panel para gestionar la cobranza de suscripciones: clientes, vencimientos, pagos, catálogo de
plataformas/combos y mensajes de WhatsApp prearmados (se envían con links `wa.me`).

**Stack:** Vite + React + TypeScript + Tailwind/shadcn, Supabase (Auth + Postgres con RLS), deploy en Vercel.

## Desarrollo

```sh
cp .env.example .env   # completar con la URL y la publishable key del proyecto de Supabase
npm install
npm run dev            # http://localhost:8080
npm test               # tests con Vitest
npm run build
```

En `.env` solo van claves públicas (`VITE_*`). La service_role / secret key de Supabase **nunca**
se pone en el repo ni en el frontend.

## Base de datos

- `supabase/esquema_completo.sql`: crea todo desde cero en un proyecto nuevo (se puede correr más de una vez).
- `supabase/migrations/`: cambios incrementales. Se aplican a mano desde el SQL Editor del dashboard
  de Supabase (o con `supabase db push`).

Tablas: `clients`, `payments`, `client_events` (historial de la ficha) y `user_configs`
(`settings` jsonb con plantillas, datos de cobro y catálogo). Cada usuario ve solo sus filas (RLS).

## Usuarios

Hay dos usuarios que comparten los mismos datos (tabla `app_members`, función `current_workspace()`):

- **Administrador** fijo: `admin@gmail.com` / `12345678`. No se modifica desde la app.
- **Usuario configurable**: su mail y contraseña se cambian en Configuración → Accesos, a través de
  la Edge Function `supabase/functions/manage-user` (deploy: `npx supabase functions deploy manage-user --use-api`).

El registro público está deshabilitado en Supabase Auth; los usuarios se crean desde el dashboard o la API admin.

## Estructura

- `src/pages/Index.tsx`: pantalla principal y estado de la app.
- `src/components/`: vistas (clientes, mensajes, plataformas, configuración, ficha, cola de envío…).
- `src/lib/api.ts`: acceso a Supabase, importación de Excel y pagos.
- `src/lib/whatsapp.ts`: plantillas, segmentos de vencimiento y armado de mensajes/links.
- `src/lib/stats.ts`: métricas del panel.
