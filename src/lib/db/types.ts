/**
 * Tipos do banco, escritos à mão e espelhando `supabase/migrations`.
 * Ao alterar uma migration, alterar aqui também.
 */

export type Role = "admin" | "coordinator" | "member";
export type ScheduleStatus =
  | "draft"
  | "collecting"
  | "building"
  | "published"
  | "archived";
export type EventKind = "mass" | "novena" | "special";
export type SignupMode = "availability" | "direct";
export type AssignmentStatus = "confirmed" | "swap_requested";
export type SwapStatus = "open" | "filled" | "cancelled";

export type Parish = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  theme: string;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export type Invite = {
  id: string;
  parish_id: string;
  email: string | null;
  role: Role;
  person_id: string | null;
  token: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type Membership = {
  id: string;
  parish_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export type Location = {
  id: string;
  parish_id: string;
  name: string;
  short_name: string | null;
  color: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export type Person = {
  id: string;
  parish_id: string;
  full_name: string;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type MassTemplate = {
  id: string;
  parish_id: string;
  location_id: string;
  weekday: number;
  start_time: string;
  slots: number;
  label: string | null;
  active: boolean;
  created_at: string;
}

export type Schedule = {
  id: string;
  parish_id: string;
  title: string;
  month: string;
  status: ScheduleStatus;
  availability_deadline: string | null;
  intro_note: string | null;
  fill_token: string;
  view_token: string;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EventRow = {
  id: string;
  schedule_id: string;
  location_id: string;
  starts_at: string;
  label: string | null;
  kind: EventKind;
  signup_mode: SignupMode;
  slots: number;
  created_at: string;
}

export type Availability = {
  id: string;
  event_id: string;
  person_id: string;
  source: "public" | "account";
  created_at: string;
}

export type Assignment = {
  id: string;
  event_id: string;
  person_id: string;
  position: number;
  status: AssignmentStatus;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SwapRequest = {
  id: string;
  assignment_id: string;
  requested_by_person: string;
  reason: string | null;
  status: SwapStatus;
  token: string;
  filled_by_person: string | null;
  filled_at: string | null;
  created_at: string;
}

export type EmailLog = {
  id: string;
  parish_id: string | null;
  kind: string;
  recipient: string;
  person_id: string | null;
  dedupe_key: string;
  error: string | null;
  sent_at: string;
}

export type AuditLog = {
  id: string;
  parish_id: string | null;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  ip_hash: string | null;
  created_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      parishes: Table<Parish>;
      profiles: Table<Profile>;
      memberships: Table<Membership>;
      invites: Table<Invite>;
      locations: Table<Location>;
      people: Table<Person>;
      mass_templates: Table<MassTemplate>;
      schedules: Table<Schedule>;
      events: Table<EventRow>;
      availabilities: Table<Availability>;
      assignments: Table<Assignment>;
      swap_requests: Table<SwapRequest>;
      email_log: Table<EmailLog>;
      audit_log: Table<AuditLog>;
    };
    // Nenhuma view/função exposta ao PostgREST; os tipos abaixo só existem
    // para satisfazer o formato que o supabase-js espera do schema.
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
