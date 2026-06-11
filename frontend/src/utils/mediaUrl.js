const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Resolves a media URL for display.
 * - Absolute URLs (http/https) → returned as-is (e.g. S3 URLs)
 * - Relative paths (/static/...) → prepended with the API base URL
 */
export function mediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API}${url}`;
}
