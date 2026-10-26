"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The walkthrough: the screen dims, one thing stays lit, and a card explains
 * what it is for.
 *
 * The checklist on the home screen says what is still missing. This says
 * where the things are. They answer different questions, which is why both
 * exist: a coordinator who has never seen the app does not know that the
 * weekly pattern lives under Group, and no amount of "4 steps left" tells
 * them.
 *
 * Steps whose target is not on screen are skipped rather than pointed at
 * nothing, which is what lets one list of steps serve the phone layout and
 * the desktop one without being written twice.
 */
const STEPS = [
  "setup",
  "schedules",
  "people",
  "group",
  "feedback",
] as const;

type Step = (typeof STEPS)[number];

const SEEN_KEY = "altar:tour-seen";

/** Where a step's card sits relative to the lit element. */
interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(step: Step): HTMLElement | null {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${step}"]`),
  );
  // The same step is tagged on the sidebar and on the phone bar; only one of
  // them is laid out at any width.
  return all.find((el) => el.getBoundingClientRect().width > 0) ?? null;
}

export function GuidedTour({ autoStart = false }: { autoStart?: boolean }) {
  const t = useTranslations("tour");
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [spot, setSpot] = React.useState<Spot | null>(null);

  const steps = React.useMemo(() => [...STEPS], []);
  const step = steps[index];

  React.useEffect(() => {
    if (!autoStart) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      // A browser with storage blocked simply gets the tour every time,
      // which is better than never getting it.
    }
    // Opening on a first visit is a decision about this mount, read from
    // storage, not state derived from a prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is an external system
    setOpen(true);
  }, [autoStart]);

  // The lit rectangle is a measurement of the live DOM, so it is read after
  // paint and again whenever the page moves under it.
  React.useEffect(() => {
    if (!open) return;

    function measure() {
      const target = findTarget(step);
      if (!target) {
        setSpot(null);
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = target.getBoundingClientRect();
      setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    // After paint, not during it: the element has to be laid out before it
    // can be measured, and measuring synchronously here would also be a
    // setState inside the effect body.
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  function close() {
    setOpen(false);
    setIndex(0);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Nothing to do: the worst case is seeing it again.
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="tap-target w-full"
        onClick={() => setOpen(true)}
      >
        {t("start")}
      </Button>
    );
  }

  const padding = 8;

  /**
   * Where the explanation sits.
   *
   * Only reached after mount, since the overlay is behind state, so reading
   * the viewport here cannot disagree with anything the server rendered.
   *
   * A tall target (the setup card fills most of a phone) leaves no room
   * either side of it, so the explanation goes to the bottom of the screen
   * instead of being pushed off it.
   */
  const viewport = typeof window === "undefined" ? 0 : window.innerHeight;
  const card: React.CSSProperties = !spot
    ? { top: "50%", transform: "translateY(-50%)" }
    : spot.height > viewport * 0.5
      ? { bottom: 16 }
      : spot.top > viewport / 2
        ? { bottom: viewport - spot.top + padding * 2 }
        : { top: spot.top + spot.height + padding * 2 };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* The dim and the hole in one element: a huge shadow spreading out
          from the lit rectangle costs no extra layers and clips nothing. */}
      <div
        className="absolute inset-0 bg-black/70 transition-[opacity] duration-200"
        onClick={close}
        style={
          spot
            ? {
                background: "transparent",
                boxShadow: "0 0 0 9999px rgba(0,0,0,.72)",
                top: spot.top - padding,
                left: spot.left - padding,
                width: spot.width + padding * 2,
                height: spot.height + padding * 2,
                borderRadius: 12,
                position: "absolute",
                inset: "auto",
              }
            : undefined
        }
      />

      <div
        className="absolute right-4 left-4 mx-auto max-h-[70svh] max-w-sm overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-xl"
        style={card}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {t("progress", { current: index + 1, total: steps.length })}
            </p>
            <h2 className="mt-1 text-base font-semibold">
              {t(`steps.${step}.title`)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`steps.${step}.body`)}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("skip")}
            onClick={close}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {index > 0 ? (
            <Button
              variant="outline"
              className="tap-target"
              onClick={() => setIndex((i) => i - 1)}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button
            className="tap-target flex-1"
            onClick={() =>
              index === steps.length - 1 ? close() : setIndex((i) => i + 1)
            }
          >
            {index === steps.length - 1 ? t("done") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
