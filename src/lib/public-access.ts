import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { loadScheduleDetail } from "@/lib/schedule/queries";
import type {
  Assignment,
  EventRow,
  Location,
  Parish,
  Person,
  Schedule,
  SwapRequest,
} from "@/lib/db/types";
import type { ScheduleDetail } from "@/lib/schedule/types";

/**
 * Tudo que entra pelo link público passa por aqui.
 *
 * Regra: o token é a única credencial, então ele é resolvido no servidor e
 * jamais confiamos num id vindo do cliente sem antes checar que pertence ao
 * objeto que o token abriu.
 */

export interface FillContext {
  schedule: Schedule;
  parish: Parish;
  detail: ScheduleDetail;
  people: Person[];
  /** Falso quando o prazo passou ou a escala saiu do período de coleta. */
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
  // Só a escala publicada (ou arquivada) é visível por este link — rascunho
  // em montagem não vaza.
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
  /** Quem marcou disponibilidade para esta celebração e não está escalado. */
  candidates: Person[];
  /** Todos os acólitos ativos — quem não marcou também pode se oferecer. */
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
 * Um nome vinculado a uma conta só pode ser movimentado pelo dono dela.
 * É o que impede que qualquer um com o link responda no lugar dos outros.
 */
export function canActAsPerson(
  person: Pick<Person, "claimed_by">,
  userId: string | null,
): boolean {
  if (!person.claimed_by) return true;
  return person.claimed_by === userId;
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
