"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Loads PostHog, but only where it belongs.
 *
 * Three deliberate restrictions, all of them because this app is opened by
 * minors through links with no sign-in:
 *   1. It never loads on the public routes (/e, /v, /t, /j, /invite). Those
 *      are the screens altar servers use, and they are none of our business.
 *   2. Autocapture is off. Clicks on a list of children's names are not data
 *      worth having.
 *   3. Session replay is off. There is no masking careful enough to make
 *      recording that screen acceptable.
 *
 * With no key configured it does nothing at all, which is the default.
 */
const PRIVATE_PREFIXES = ["/e/", "/v/", "/t/", "/j/", "/invite/"];

export function AnalyticsProvider({ userId }: { userId?: string | null }) {
  const pathname = usePathname();
  const blocked = PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));

  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!key || blocked) return;

    let cancelled = false;
    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      posthog.init(key, {
        // PostHog's own default. Guessing the other region does not fail
        // loudly, it just posts every event where nothing is listening.
        api_host: host ?? "https://us.i.posthog.com",
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: true,
        capture_pageleave: false,
        persistence: "localStorage",
        // The account's own id, never its address or its name.
        bootstrap: userId ? { distinctID: userId } : undefined,
      });
      (window as unknown as { posthog?: unknown }).posthog = posthog;
    });

    return () => {
      cancelled = true;
    };
  }, [blocked, userId]);

  return null;
}
