import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Health check for the Supabase connection.
 *
 *   GET /api/health/db → { ok: true, cellCount: 9, statuses: {...} }
 *
 * Uses the public RLS-enabled client (no service role) so a successful
 * response also confirms anon-key auth and the SELECT policy on `cells`.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("cells")
    .select("id, status", { count: "exact" })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 500 },
    );
  }

  const statuses = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ ok: true, cellCount: count, statuses, cells: data });
}
