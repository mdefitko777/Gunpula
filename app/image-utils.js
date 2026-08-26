const REMOTE_APP_BASE = "https://mdefitko777.github.io/Gunpula/app/";

export function resolveImageUrl(url) {
  const value = String(url || "");
  const nativeShell = Boolean(window.Capacitor?.isNativePlatform?.());
  return nativeShell && value.startsWith("./") ? `${REMOTE_APP_BASE}${value.slice(2)}` : value;
}

export function uniqueImageUrls(urls) {
  return [...new Set((urls || []).filter(Boolean).map(resolveImageUrl))];
}

export function setImageFallbackChain(img, urls, onExhausted) {
  const candidates = uniqueImageUrls(urls);
  if (!candidates.length) {
    onExhausted?.();
    return false;
  }
  let index = 0;
  img.src = candidates[index];
  img.addEventListener("error", () => {
    index += 1;
    if (index < candidates.length) img.src = candidates[index];
    else onExhausted?.();
  });
  return true;
}

export function appendImageWithFallback(container, urls, options = {}) {
  const candidates = uniqueImageUrls(urls);
  if (!candidates.length) {
    options.onExhausted?.();
    return false;
  }
  const img = document.createElement("img");
  img.alt = options.alt || "";
  img.loading = options.loading || "lazy";
  img.decoding = "async";
  img.fetchPriority = options.fetchPriority || (img.loading === "lazy" ? "low" : "auto");
  container.append(img);
  return setImageFallbackChain(img, candidates, () => {
    img.remove();
    options.onExhausted?.();
  });
}
