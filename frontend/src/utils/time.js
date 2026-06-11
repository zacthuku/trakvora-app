/**
 * Returns a human-readable relative time string for an ISO timestamp.
 * e.g. "just now", "3 mins ago", "2 hrs ago", "1d ago"
 */
export function timeAgo(isoString) {
  if (!isoString) return null;
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  { const m = Math.floor(diff / 60);  return `${m} min${m !== 1 ? "s" : ""} ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h} hr${h !== 1 ? "s" : ""} ago`; }
  const d = Math.floor(diff / 86400);
  return `${d}d ago`;
}
