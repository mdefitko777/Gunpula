// Email-code (OTP) auth against Supabase GoTrue with a localStorage session.
// Plain fetch, no SDK — matches the rest of the app.
const SESSION_KEY = "gunpula-auth-session-v1";

let backend = { url: "", anonKey: "" };
let session = loadSession();
let refreshPromise = null;

function cleanUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

export function configureAuth(config = {}) {
  backend = { url: cleanUrl(config.url), anonKey: String(config.anonKey || "").trim() };
}

export function authConfigured() {
  return Boolean(backend.url && backend.anonKey);
}

export function authBackend() {
  return backend;
}

export function isSignedIn() {
  return Boolean(session?.refresh_token);
}

export function currentUserEmail() {
  return session?.user?.email || "";
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(next) {
  session = next;
  if (next) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function normalizeSession(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: { id: data.user?.id || "", email: data.user?.email || "" },
  };
}

async function authRequest(path, body) {
  const response = await fetch(`${backend.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: backend.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || response.statusText || "auth error");
  }
  return data;
}

export async function requestEmailCode(email) {
  await authRequest("otp", { email: String(email).trim(), create_user: true });
}

export async function verifyEmailCode(email, code) {
  const data = await authRequest("verify", { type: "email", email: String(email).trim(), token: String(code).trim() });
  if (!data?.access_token) {
    throw new Error("auth error");
  }
  storeSession(normalizeSession(data));
  return session;
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then((data) => storeSession(normalizeSession(data)))
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Returns a valid access token, refreshing when close to expiry.
// Returns null (and clears the session) when the refresh token is dead.
export async function getAccessToken() {
  if (!session?.refresh_token || !authConfigured()) {
    return null;
  }
  if ((session.expires_at || 0) - 60 < Math.floor(Date.now() / 1000)) {
    try {
      await refreshSession();
    } catch {
      storeSession(null);
      return null;
    }
  }
  return session.access_token;
}

export function signOut() {
  storeSession(null);
}
