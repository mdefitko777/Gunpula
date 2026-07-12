// Shared Supabase backend for account sync. Fill these once and commit:
// the anon key is public by design — data access is enforced by RLS and the
// RPC functions from docs/supabase-setup-v2.sql, never by hiding this key.
// While these stay empty, the app falls back to the URL/key stored by the
// legacy manual sync settings on this device.
export const SYNC_BACKEND = {
  url: "https://wubayglibvumuozhkmew.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1YmF5Z2xpYnZ1bXVvemhrbWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTM1NDYsImV4cCI6MjA5NzI2OTU0Nn0.URi5M9KFZ47NX2Yd53uPu9E5Tokjsy_jmfZTMbmFS9E",
};
