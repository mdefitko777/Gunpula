const TAMASHII_HOST_PATTERN = /(?:^|\.)tamashiiweb\.com$/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function decodeAttribute(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseUrl(value, baseUrl) {
  try {
    return new URL(decodeAttribute(value), baseUrl);
  } catch {
    return null;
  }
}

function isImagePath(pathname) {
  return IMAGE_EXTENSION_PATTERN.test(pathname);
}

function isTamashiiUrl(url) {
  return TAMASHII_HOST_PATTERN.test(url.hostname);
}

export function tamashiiItemIdFromUrl(detailUrl) {
  const url = parseUrl(detailUrl, "https://tamashiiweb.com");
  const match = url?.pathname.match(/\/item\/(\d+)\/?$/);
  return match?.[1] ?? null;
}

export function tamashiiItemIdFromKitId(kitId) {
  const match = String(kitId ?? "").match(/^tamashii-(\d+)$/);
  return match?.[1] ?? null;
}

function importedImageItemId(pathname) {
  const match = pathname.match(/\/storage\/images\/products\/imported\/item_(\d+)_/i);
  return match ? String(Number(match[1])) : null;
}

function assetItemId(pathname) {
  const match = pathname.match(/\/assets\/item\/([^/]+)/i);
  if (!match) return null;
  const numeric = match[1].match(/\d+/);
  return numeric ? String(Number(numeric[0])) : null;
}

function isGenericProductImage(pathname) {
  return /\/storage\/images\/products\/(?:thumbnail|main|sub)\//i.test(pathname);
}

function isImportedProductImage(pathname) {
  return /\/storage\/images\/products\/imported\//i.test(pathname);
}

function isAssetItemImage(pathname) {
  return /\/assets\/item\//i.test(pathname);
}

export function isCurrentTamashiiGalleryImage(value, itemId, { allowGenericProductImage = true } = {}) {
  const url = parseUrl(value, "https://tamashiiweb.com");
  if (!url || !isImagePath(url.pathname)) return false;
  if (!isTamashiiUrl(url)) return true;

  if (isImportedProductImage(url.pathname)) {
    return importedImageItemId(url.pathname) === String(Number(itemId));
  }

  if (isAssetItemImage(url.pathname)) {
    return assetItemId(url.pathname) === String(Number(itemId));
  }

  return allowGenericProductImage && isGenericProductImage(url.pathname);
}

function normalizeImageUrl(value, baseUrl) {
  const url = parseUrl(value, baseUrl);
  if (!url || !isImagePath(url.pathname)) return null;
  return url.href;
}

function imageUrlsFromHtml(html, pattern, baseUrl) {
  return [...String(html ?? "").matchAll(pattern)]
    .map((match) => normalizeImageUrl(match[1], baseUrl))
    .filter(Boolean);
}

function productGalleryBlocks(html) {
  const blocks = [
    ...String(html ?? "").matchAll(/<div[^>]*class=["'][^"']*\bproductMainImg\b[^"']*["'][\s\S]*?<\/ul>/gi),
    ...String(html ?? "").matchAll(/<section[^>]*class=["'][^"']*\bitem-detail__gallery\b[^"']*["'][\s\S]*?<\/section>/gi),
  ].map((match) => match[0]);
  return blocks.join("\n");
}

export function extractTamashiiGalleryImages(html, detailUrl) {
  const itemId = tamashiiItemIdFromUrl(detailUrl);
  const galleryHtml = productGalleryBlocks(html);
  const productImagePattern =
    /(?:href|src|data-src)=["']([^"']*\/storage\/images\/products\/(?:thumbnail|main|sub|imported)\/[^"']+)["']/gi;
  const assetItemPattern = /(?:href|src|data-src)=["']([^"']*\/assets\/item\/[^"']+)["']/gi;

  const galleryBlockImages = imageUrlsFromHtml(galleryHtml, productImagePattern, detailUrl).filter((url) =>
    isCurrentTamashiiGalleryImage(url, itemId, { allowGenericProductImage: true })
  );
  const currentImportedImages = imageUrlsFromHtml(html, productImagePattern, detailUrl).filter((url) =>
    isCurrentTamashiiGalleryImage(url, itemId, { allowGenericProductImage: false })
  );
  const currentAssetImages = imageUrlsFromHtml(html, assetItemPattern, detailUrl).filter((url) =>
    isCurrentTamashiiGalleryImage(url, itemId, { allowGenericProductImage: false })
  );

  return unique([...galleryBlockImages, ...currentImportedImages, ...currentAssetImages]);
}

export function cleanTamashiiGalleryUrls(galleryUrls, kitId) {
  const itemId = tamashiiItemIdFromKitId(kitId);
  if (!itemId) return galleryUrls ?? [];
  return unique((galleryUrls ?? []).filter((url) => isCurrentTamashiiGalleryImage(url, itemId)));
}
