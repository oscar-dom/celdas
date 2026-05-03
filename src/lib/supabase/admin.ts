import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses RLS — server-only.
 *
 * Use exclusively in:
 *   - Cron route handlers
 *   - Webhook handlers (Stripe, PayPal)
 *   - Admin operations that require elevated privileges
 *
 * Never import this in code that reaches the client bundle.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
