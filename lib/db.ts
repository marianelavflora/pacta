// Cliente de Supabase para el servidor. Usa la service role key, que saltea RLS:
// nunca lo importes desde un componente del navegador.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getDb(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Falta configurar ${missing.join(" y ")} en .env.local (ver .env.example).`,
    );
  }

  client = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
