import {
  configureAuth,
  currentUserEmail,
  getAccessToken,
  isSignedIn,
  requestEmailCode,
  signOut,
  verifyEmailCode,
} from "../app/auth.js";
import { SYNC_BACKEND } from "../app/sync-config.js";
import { applyChange, cloneCmsState, EMPTY_CMS_STATE } from "./cms-model.js";

const LOCAL_KEY = "gunpula-cms-local-backend-v1";
const isLocalHost = ["localhost", "127.0.0.1"].includes(location.hostname);

configureAuth(SYNC_BACKEND);

function loadLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (parsed) return parsed;
  } catch {
    // A corrupt local draft must not block the development console.
  }
  return {
    admin: { email: "local@development", display_name: "Local administrator" },
    published: { revision: 0, payload: cloneCmsState(), updated_at: null },
    drafts: [],
    history: [],
    releases: [],
    nextId: 1,
  };
}

function saveLocal(value) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
}

async function rpc(name, body = {}, { auth = true } = {}) {
  const token = auth ? await getAccessToken() : null;
  const response = await fetch(`${SYNC_BACKEND.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SYNC_BACKEND.anonKey,
      Authorization: `Bearer ${token || SYNC_BACKEND.anonKey}`,
      "Content-Type": "application/json",
    },
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
    throw new Error(data?.message || data?.hint || data?.error || response.statusText);
  }
  return data;
}

export function authState() {
  return {
    configured: Boolean(SYNC_BACKEND.url && SYNC_BACKEND.anonKey),
    signedIn: isSignedIn(),
    email: currentUserEmail(),
    localDevelopment: isLocalHost,
  };
}

export async function sendCode(email) {
  return requestEmailCode(email);
}

export async function verifyCode(email, code) {
  return verifyEmailCode(email, code);
}

export function logout() {
  signOut();
}

export async function loadBootstrap() {
  if (isSignedIn()) {
    try {
      return await rpc("gunpula_cms_get_bootstrap");
    } catch (error) {
      if (!isLocalHost) throw error;
    }
  }
  if (isLocalHost) return loadLocal();
  throw new Error("请先使用管理员邮箱登录");
}

export async function saveChange(change) {
  if (isSignedIn()) {
    return rpc("gunpula_cms_save_change", {
      p_entity_type: change.entity_type,
      p_entity_id: change.entity_id,
      p_operation: change.operation,
      p_patch: change.patch || {},
      p_before_value: change.before_value || {},
      p_batch_id: change.batch_id || crypto.randomUUID(),
    });
  }
  if (!isLocalHost) throw new Error("管理员登录已失效");
  const backend = loadLocal();
  const record = {
    ...change,
    id: backend.nextId++,
    batch_id: change.batch_id || crypto.randomUUID(),
    status: "draft",
    created_at: new Date().toISOString(),
    created_by: "local",
  };
  backend.drafts.push(record);
  backend.history.unshift(record);
  saveLocal(backend);
  return record;
}

export async function saveChanges(changes) {
  if (!changes.length) return [];
  if (isSignedIn()) return rpc("gunpula_cms_save_batch", { p_changes: changes });
  const batchId = crypto.randomUUID();
  const records = [];
  for (const change of changes) records.push(await saveChange({ ...change, batch_id: batchId }));
  return records;
}

export async function undoChange(id) {
  if (isSignedIn()) return rpc("gunpula_cms_undo_change", { p_change_id: id });
  if (!isLocalHost) throw new Error("管理员登录已失效");
  const backend = loadLocal();
  const draft = backend.drafts.find((item) => item.id === id);
  if (!draft) throw new Error("找不到待撤销的变更");
  const ids = new Set(backend.drafts.filter((item) => item.batch_id === draft.batch_id).map((item) => item.id));
  for (const item of backend.drafts) {
    if (ids.has(item.id)) item.status = "undone";
  }
  backend.drafts = backend.drafts.filter((item) => !ids.has(item.id));
  for (const history of backend.history) {
    if (ids.has(history.id)) history.status = "undone";
  }
  saveLocal(backend);
  return { ...draft, undone_count: ids.size };
}

export async function publishChanges(note) {
  if (isSignedIn()) return rpc("gunpula_cms_publish", { p_note: note || "" });
  if (!isLocalHost) throw new Error("管理员登录已失效");
  const backend = loadLocal();
  if (!backend.drafts.length) throw new Error("没有待发布变更");
  let payload = cloneCmsState(backend.published?.payload || EMPTY_CMS_STATE);
  for (const change of backend.drafts) payload = applyChange(payload, change);
  const revision = Number(backend.published?.revision || 0) + 1;
  const release = {
    id: revision,
    revision,
    note: note || "",
    change_count: backend.drafts.length,
    published_at: new Date().toISOString(),
  };
  for (const draft of backend.drafts) {
    draft.status = "published";
    draft.published_revision = revision;
    const history = backend.history.find((item) => item.id === draft.id);
    if (history) Object.assign(history, draft);
  }
  backend.published = { revision, payload, updated_at: release.published_at };
  backend.releases.unshift(release);
  backend.drafts = [];
  saveLocal(backend);
  return release;
}

export async function updateReleaseNote(revision, note) {
  if (isSignedIn()) {
    try {
      return await rpc("gunpula_cms_update_release_note", {
        p_revision: Number(revision),
        p_note: String(note || ""),
      });
    } catch (error) {
      if (/gunpula_cms_update_release_note|schema cache/i.test(error.message)) {
        throw new Error("请先在 Supabase SQL Editor 运行 docs/supabase-cms-release-note-upgrade.sql");
      }
      throw error;
    }
  }
  if (!isLocalHost) throw new Error("管理员登录已失效");
  const backend = loadLocal();
  const release = backend.releases.find((item) => Number(item.revision) === Number(revision));
  if (!release) throw new Error("找不到这个发布版本");
  release.note = String(note || "");
  saveLocal(backend);
  return release;
}

export async function loadPublishedState() {
  try {
    return await rpc("gunpula_cms_get_published", {}, { auth: false });
  } catch {
    return isLocalHost ? loadLocal().published : { revision: 0, payload: cloneCmsState() };
  }
}

export function clearLocalCms() {
  if (isLocalHost) localStorage.removeItem(LOCAL_KEY);
}
