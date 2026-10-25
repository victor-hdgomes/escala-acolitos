import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadScheduleDetail } from "@/lib/schedule/queries";
import type {
  Assignment,
  EventRow,
  JoinLink,
  Location,
  Parish,
  Person,
  Schedule,
  SwapRequest,
} from "@/lib/db/types";
import type { ScheduleDetail } from "@/lib/schedule/types";

/**
 * Everything that comes in through a public link passes through here.
 *
 * The rule: the token is the only credential, so it is resolved on the server
 * and an id coming from the client is never trusted until it has been checked
 * against the object the token opened.
 */

export interface FillContext {
  schedule: Schedule;
  parish: Parish;
  detail: ScheduleDetail;
  people: Person[];
  /** False once the deadline has passed or the schedule left the collecting period. */
  open: boolean;
  closedReason: "deadline" | "status" | null;
}

export async function resolveFillToken(
  token: string,
): Promise<FillContext | null> {
  const admin = createAdminClient();
  const { data: schedule } = await admin
    .from("schedules")
    .select("*")
    .eq("fill_token", token)
    .maybeSingle();
  if (!schedule) return null;

  const [{ data: parish }, { data: people }, detail] = await Promise.all([
    admin.from("parishes").select("*").eq("id", schedule.parish_id).single(),
    admin
      .from("people")
      .select("*")
      .eq("parish_id", schedule.parish_id)
      .eq("active", true)
      .order("full_name", { ascending: true }),
    loadScheduleDetail(admin, schedule.id, { withAvailability: true }),
  ]);
  if (!parish || !detail) return null;

  const closedReason = fillClosedReason(schedule as Schedule);
  return {
    schedule: schedule as Schedule,
    parish: parish as Parish,
    detail,
    people: (people ?? []) as Person[],
    open: closedReason === null,
    closedReason,
  };
}

export function fillClosedReason(
  schedule: Schedule,
): "deadline" | "status" | null {
  if (schedule.status !== "collecting" && schedule.status !== "building") {
    return "status";
  }
  if (
    schedule.availability_deadline &&
    Date.parse(schedule.availability_deadline) < Date.now()
  ) {
    return "deadline";
  }
  return null;
}

export interface ViewContext {
  schedule: Schedule;
  parish: Parish;
  detail: ScheduleDetail;
}

export async function resolveViewToken(
  token: string,
): Promise<ViewContext | null> {
  const admin = createAdminClient();
  const { data: schedule } = await admin
    .from("schedules")
    .select("*")
    .eq("view_token", token)
    .maybeSingle();
  // Only a published (or archived) schedule is visible through this link - a
  // draft still being built never leaks.
  if (!schedule) return null;
  if (schedule.status !== "published" && schedule.status !== "archived") {
    return null;
  }

  const [{ data: parish }, detail] = await Promise.all([
    admin.from("parishes").select("*").eq("id", schedule.parish_id).single(),
    loadScheduleDetail(admin, schedule.id),
  ]);
  if (!parish || !detail) return null;

  return { schedule: schedule as Schedule, parish: parish as Parish, detail };
}

export interface SwapContext {
  swap: SwapRequest;
  assignment: Assignment;
  event: EventRow;
  location: Location;
  schedule: Schedule;
  parish: Parish;
  requester: Person;
  filledBy: Person | null;
  /** Who marked availability for this celebration and is not scheduled. */
  candidates: Person[];
  /** Every active altar server - someone who did not mark can still offer. */
  people: Person[];
}

export async function resolveSwapToken(
  token: string,
): Promise<SwapContext | null> {
  const admin = createAdminClient();
  const { data: swap } = await admin
    .from("swap_requests")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!swap) return null;

  const { data: assignment } = await admin
    .from("assignments")
    .select("*")
    .eq("id", swap.assignment_id)
    .maybeSingle();
  if (!assignment) return null;

  const { data: event } = await admin
    .from("events")
    .select("*")
    .eq("id", assignment.event_id)
    .maybeSingle();
  if (!event) return null;

  const [{ data: schedule }, { data: location }] = await Promise.all([
    admin.from("schedules").select("*").eq("id", event.schedule_id).single(),
    admin.from("locations").select("*").eq("id", event.location_id).single(),
  ]);
  if (!schedule || !location) return null;

  const { data: parish } = await admin
    .from("parishes")
    .select("*")
    .eq("id", schedule.parish_id)
    .single();
  if (!parish) return null;

  const [{ data: people }, { data: avail }, { data: eventAssignments }] =
    await Promise.all([
      admin
        .from("people")
        .select("*")
        .eq("parish_id", schedule.parish_id)
        .eq("active", true)
        .order("full_name", { ascending: true }),
      admin.from("availabilities").select("person_id").eq("event_id", event.id),
      admin.from("assignments").select("person_id").eq("event_id", event.id),
    ]);

  const allPeople = (people ?? []) as Person[];
  const byId = new Map(allPeople.map((p) => [p.id, p]));
  const taken = new Set((eventAssignments ?? []).map((a) => a.person_id));

  const candidates = (avail ?? [])
    .map((a) => byId.get(a.person_id))
    .filter((p): p is Person => !!p && !taken.has(p.id));

  return {
    swap: swap as SwapRequest,
    assignment: assignment as Assignment,
    event: event as EventRow,
    location: location as Location,
    schedule: schedule as Schedule,
    parish: parish as Parish,
    requester: byId.get(swap.requested_by_person)!,
    filledBy: swap.filled_by_person
      ? (byId.get(swap.filled_by_person) ?? null)
      : null,
    candidates,
    people: allPeople,
  };
}

/**
 * A name linked to an account can only be moved by that account's owner.
 * It is what stops anyone holding the link from answering for other people.
 */
export function canActAsPerson(
  person: Pick<Person, "claimed_by">,
  userId: string | null,
): boolean {
  if (!person.claimed_by) return true;
  return person.claimed_by === userId;
}

export interface JoinLinkContext {
  link: JoinLink;
  parish: Parish;
  /** Null while the link still works; otherwise why it does not. */
  closedReason: JoinLinkClosedReason | null;
}

export type JoinLinkClosedReason = "inactive" | "expired" | "exhausted";

/**
 * Reads a join link without spending it. The screen needs to name the group
 * before anyone signs up, and a visitor who is not in the group yet could not
 * read the row under RLS, so this goes through the service role like every
 * other token here.
 */
export async function resolveJoinLink(
  token: string,
): Promise<JoinLinkContext | null> {
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("join_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;

  const { data: parish } = await admin
    .from("parishes")
    .select("*")
    .eq("id", link.parish_id)
    .maybeSingle();
  if (!parish) return null;

  return {
    link: link as JoinLink,
    parish: parish as Parish,
    closedReason: joinLinkClosedReason(link as JoinLink),
  };
}

export function joinLinkClosedReason(
  link: JoinLink,
): JoinLinkClosedReason | null {
  if (!link.active) return "inactive";
  if (link.expires_at && Date.parse(link.expires_at) < Date.now()) {
    return "expired";
  }
  if (link.max_uses !== null && link.uses >= link.max_uses) return "exhausted";
  return null;
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
