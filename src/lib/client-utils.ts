/** Browser utilities - nothing here runs on the server. */

/** The same base URL as the server's, resolved on the client. */
export function appUrlClient(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Universal WhatsApp link: opens Web on the desktop and the app on a phone. */
export function whatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Native sharing where it exists (phones), clipboard as the fallback.
 */
export async function shareOrCopy(
  title: string,
  text: string,
): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "cancelled";
  }
}
