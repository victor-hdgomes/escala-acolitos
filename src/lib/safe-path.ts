/**
 * The internal paths this app is willing to follow after signing someone in.
 *
 * A bare `startsWith("/")` is not enough: a browser reads "//evil.example"
 * and "/\\evil.example" as protocol relative URLs, so either one takes a
 * freshly authenticated person straight off the app, with the referrer
 * intact. The check demands exactly one leading slash.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/home",
): string {
  if (!value) return fallback;
  return /^\/(?![/\\])/.test(value) ? value : fallback;
}
