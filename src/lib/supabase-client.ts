import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function getPublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // `PUBLISHABLE_KEY` is Supabase's current name. The fallback makes an
  // existing project using the older anon-key name work without exposing a
  // secret (both are browser-safe public keys, never the service-role key).
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getPublicConfig();
  return Boolean(url && key);
}

/**
 * This app reads user records from IndexedDB, not during server rendering, so
 * a browser client with persisted session storage is the smallest secure fit.
 */
export function getSupabaseBrowserClient(): SupabaseClient | undefined {
  if (typeof window === "undefined") return undefined;
  if (client) return client;

  const { url, key } = getPublicConfig();
  if (!url || !key) return undefined;

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return client;
}
