/**
 * Percent-encode each segment of a bundle-relative path, leaving the `/` separators intact.
 * Used for the file API URL, the router push and the hover payload preload, which all have to
 * agree on the encoding or they address different routes.
 */
export function encodePathSegments(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
