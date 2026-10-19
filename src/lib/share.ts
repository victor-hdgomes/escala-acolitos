/**
 * Compartilhamento de texto.
 *
 * O `navigator.share` só existe em navegador móvel; no desktop sobrava
 * copiar-e-colar, que é o caminho ruim. O link `wa.me` cobre os dois: abre o
 * WhatsApp Web no computador e o app no celular, com o texto já preenchido.
 */

/** Link universal do WhatsApp com a mensagem pré-preenchida. */
export function whatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Share nativo quando existe (celular), clipboard como alternativa.
 * Retorna `"copied"` quando caiu no clipboard, pra quem chama exibir o toast.
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
    // Usuário fechou a folha de compartilhamento, ou o clipboard foi negado.
    return "cancelled";
  }
}
