export function getWebsiteName(): string | null {
  const fullTitle = document.title;
  if (!fullTitle) return null;

  const delimiters = [" - ", " | ", " : ", " · ", " — "];

  // Find the first delimiter that splits the title
  for (const delimiter of delimiters) {
    const parts = fullTitle.split(delimiter);
    if (parts.length > 1) {
      return parts[0]!.trim();
    }
  }

  return fullTitle.trim();
}

export function getFavicon(): string | null {
  const el = document.querySelector(
    'link[sizes="192x192"], link[sizes="180x180"], link[rel="icon"], link[rel="shortcut icon"]'
  );
  const href = el?.getAttribute('href');
  if (!href) return null;

  try {
    const url = new URL(href, document.location.href);
    // Make sure no malicious URLs are returned like "javascript:..."
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.href;
  } catch (e) {
    return null;
  }
}
