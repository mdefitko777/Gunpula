// Shared Supabase backend for account sync. Fill these once and commit:
// the anon key is public by design — data access is enforced by RLS and the
// RPC functions from docs/supabase-setup-v2.sql, never by hiding this key.
// While these stay empty, the app falls back to the URL/key stored by the
// legacy manual sync settings on this device.
export const SYNC_BACKEND = {
  url: "",
  anonKey: "",
};
