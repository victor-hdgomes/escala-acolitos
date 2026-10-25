"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Chrome hands this event over instead of showing its own banner, and it is
 * the only way to open the real install dialog. Not in lib.dom yet.
 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android" | "ios" | "desktop";

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

/** Only read on click, so the server and the first paint agree. */
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Puts the app on the reader's home screen.
 *
 * It is a web app, so there is no store listing and nothing to download, and
 * that is exactly the part nobody discovers on their own: a volunteer gets a
 * link in the group chat, opens it in a browser tab and loses it. One button
 * turns that tab into an icon.
 *
 * Browsers disagree about how. Chrome fires `beforeinstallprompt` and lets
 * the page open the real dialog; Safari never will, so iOS gets the three
 * words that describe its own Share menu. Hidden once it is installed, since
 * from inside the installed app there is nothing left to offer.
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
  const [platform, setPlatform] = React.useState<Platform>("desktop");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function capture(event: Event) {
      // Holding the event back is what keeps Chrome's own banner from
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

  if (standalone) return null;

  async function activate() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // The event is single-use: once answered, the browser will fire a new
      // one if it still thinks the app is installable.
      setPrompt(null);
      if (outcome === "accepted") return;
    }
    setPlatform(detectPlatform());
    setOpen(true);
  }

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => void activate()}
      >
        <Smartphone className="h-4 w-4" />
        {t("action")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <p className="text-sm">{t(platform)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("dismiss")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
