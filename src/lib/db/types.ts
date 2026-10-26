/**
 * Database types, written by hand and mirroring `supabase/migrations`.
 * Change a migration, change this too.
 */

export type Role = "admin" | "coordinator" | "member";
export type ScheduleStatus =
  | "draft"
  | "collecting"
  | "building"
  | "published"
  | "archived";
export type EventKind = "mass" | "novena" | "special";
/** What the schedule is: a whole month, a standalone novena, or another devotion. */
export type ScheduleKind = "monthly" | "novena" | "special";
export type SignupMode = "availability" | "direct";
export type AssignmentStatus = "confirmed" | "swap_requested";
export type SwapStatus = "open" | "filled" | "cancelled";
/** Who may answer a schedule: anyone holding the link, or only group accounts. */
export type FillAccess = "open" | "members";
/** What a coordinator is telling the owner of the installation. */
export type FeedbackKind = "idea" | "problem" | "question" | "other";
export type FeedbackStatus = "new" | "read" | "done";

export type Parish = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  fill_access: FillAccess;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  theme: string;
  is_superadmin: boolean;
  /** Short code the account reads out to a coordinator to be added. */
  join_code: string;
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

/**
 * A reusable way in. Unlike an invite, it is not burnt on acceptance: the
 * coordinator posts it once and everyone who signs up through it joins.
 */
export type JoinLink = {
  id: string;
  parish_id: string;
  token: string;
  role: Role;
  label: string | null;
  active: boolean;
  expires_at: string | null;
  /** Null means no ceiling on how many people may use it. */
  max_uses: number | null;
  uses: number;
  created_by: string | null;
  created_at: string;
}

export type Feedback = {
  id: string;
  parish_id: string | null;
  user_id: string | null;
  kind: FeedbackKind;
  message: string;
  /** The screen they were on when they wrote it. */
  page: string | null;
  contact_email: string | null;
  status: FeedbackStatus;
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
  kind: ScheduleKind;
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
      join_links: Table<JoinLink>;
      feedback: Table<Feedback>;
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
    // No view or function is exposed to PostgREST; the types below exist only
    // to satisfy the shape supabase-js expects from the schema.
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
