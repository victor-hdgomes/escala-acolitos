"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENTS, track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Chrome hands this event over instead of showing its own banner, and it is
 * the only way to open the real install dialog. Not in lib.dom yet.
 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS never implemented the media query for its own home-screen apps.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Puts the app on the reader's home screen, through the browser's own dialog.
 *
 * It renders nothing at all unless the browser has offered a real install
 * prompt. A button that only explains where the Share menu is asks a
 * volunteer to follow instructions, which is the thing this product exists
 * to stop doing; better to show no button than a button that teaches.
 *
 * In practice that means it appears on Chrome, Edge and Samsung Internet,
 * once the manifest, the icons and the service worker are all in place, and
 * stays hidden on iOS, where Safari implements no install API of any kind.
 */
export function InstallAppButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const t = useTranslations("shell.install");
  const standalone = React.useSyncExternalStore(
    subscribeDisplayMode,
    readStandalone,
    () => false,
  );

  const [prompt, setPrompt] = React.useState<InstallPrompt | null>(null);

  React.useEffect(() => {
    function capture(event: Event) {
      // Holding the event back is what keeps the browser's own banner from
      // appearing at a random moment; the button owns the invitation.
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    function installed() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (standalone || !prompt) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    track(EVENTS.installPrompted, { accepted: outcome === "accepted" });
    // The event is single use. If the browser still considers the app
    // installable it fires a fresh one, which brings the button back.
    setPrompt(null);
  }

  return (
    <Button
      variant={variant}
      size="sm"
      className={cn("gap-2", className)}
      onClick={() => void install()}
    >
      <Smartphone className="h-4 w-4" />
      {t("action")}
    </Button>
  );
}
