import { createClient } from "@supabase/supabase-js";

// Browser/client-side client — safe to use in components, uses the anon key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-side only client — uses the service role key, bypasses RLS.
// Use this ONLY inside /app/api routes (never import it into a client component).
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
