/** Utilidades de browser — nada aqui roda no servidor. */

/** Mesma URL base do servidor, resolvida no client. */
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

/** Link universal do WhatsApp: abre o Web no desktop e o app no celular. */
export function whatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Compartilhamento nativo quando existe (celular), clipboard como alternativa.
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
