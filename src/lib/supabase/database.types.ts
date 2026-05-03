/**
 * Placeholder for Supabase-generated database types.
 *
 * Once the schema is applied to the remote project, regenerate with:
 *
 *   pnpm exec supabase gen types typescript --project-id <PROJECT_REF> > src/lib/supabase/database.types.ts
 *
 * Or for the local DB:
 *
 *   pnpm exec supabase gen types typescript --local > src/lib/supabase/database.types.ts
 */
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
