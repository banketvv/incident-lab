export function searchUrl(term) {
  return `/api/search?query=${encodeURIComponent(term)}`;
}
