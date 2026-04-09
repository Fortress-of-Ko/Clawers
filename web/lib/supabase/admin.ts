import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseServer: SupabaseClient | null = null;
let supabaseServiceServer: SupabaseClient | null = null;

function createSupabaseAdmin(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseServer(serviceRoleOnly = false): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  if (serviceRoleOnly) {
    if (supabaseServiceServer) return supabaseServiceServer;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return null;
    supabaseServiceServer = createSupabaseAdmin(url, serviceKey);
    return supabaseServiceServer;
  }

  if (supabaseServer) return supabaseServer;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) return null;
  supabaseServer = createSupabaseAdmin(url, key);
  return supabaseServer;
}
