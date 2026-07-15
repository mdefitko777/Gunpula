export function getString(key, fallback = "") {
  return localStorage.getItem(key) ?? fallback;
}

export function setString(key, value) {
  localStorage.setItem(key, String(value));
}

export function removeValue(key) {
  localStorage.removeItem(key);
}

export function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
