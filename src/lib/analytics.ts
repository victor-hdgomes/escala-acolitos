/**
 * The handful of things worth knowing about how this app gets used.
 *
 * Named events only. Autocapture is off, and so is session replay, because
 * the public screens of this product are filled in by children: an altar
 * server of thirteen picking their own name off a list. A replay of that is
 * a recording of a minor's name in a third party service, and no product
 * question is worth it.
 *
 * Nothing here ever carries a name, an e-mail address or a token. The ids are
 * opaque and the counts are counts.
 */

export const EVENTS = {
  groupCreated: "group_created",
  placeAdded: "place_added",
  patternSaved: "weekly_pattern_saved",
  scheduleCreated: "schedule_created",
  fillLinkShared: "fill_link_shared",
  schedulePublished: "schedule_published",
  swapOpened: "swap_opened",
  swapFilled: "swap_filled",
  joinLinkCreated: "join_link_created",
  joinLinkRedeemed: "join_link_redeemed",
  feedbackSent: "feedback_sent",
  installPrompted: "install_prompted",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Counts and flags only. Never a name, an address or a token. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (typeof window === "undefined") return;
  const posthog = (
    window as unknown as {
      posthog?: { capture: (e: string, p?: AnalyticsProps) => void };
    }
  ).posthog;
  // Absent when no key is configured, which is the normal state of a parish
  // running this for itself. Measuring is optional; the app is not.
  posthog?.capture(event, props);
}
