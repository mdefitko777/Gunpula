import { SYNC_BACKEND } from "@app/sync-config.js";
import {
  configureAuth, isSignedIn, currentUserEmail, requestEmailCode,
  verifyEmailCode, getAccessToken, signOut, authBackend,
} from "@app/auth.js";

// Account sync reuses the vanilla auth module and the same v2 RPCs, so a user
// signed in on either build sees the same workspace and collection.
configureAuth(SYNC_BACKEND);

export { isSignedIn, currentUserEmail, requestEmailCode, verifyEmailCode, signOut };

async function rpc(fn, body = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("not signed in");
  const { url, anonKey } = authBackend();
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.hint || res.statusText);
  return data;
}

export const pullState = () => rpc("gunpula_v2_get_state");

export const pushState = (payload, baseRevision = 0, reason = "ionic") =>
  rpc("gunpula_v2_save_state", { p_payload: payload, p_base_revision: baseRevision, p_reason: reason });

export const createWorkspace = (displayName) =>
  rpc("gunpula_v2_create_workspace", { p_name: "", p_display_name: displayName });

export const joinWorkspace = (code, displayName) =>
  rpc("gunpula_v2_join_workspace", { p_invite_code: code, p_display_name: displayName });

export const leaveWorkspace = () => rpc("gunpula_v2_leave_workspace");
