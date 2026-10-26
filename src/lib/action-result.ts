/**
 * The contract between Server Actions and the UI.
 *
 * Actions never return prose. They return a machine code plus the values the
 * sentence needs, and the client renders it through the message catalog. Three
 * reasons this is worth the indirection:
 *
 *   1. The server has no reliable locale for a given reader - the same parish
 *      has a Brazilian coordinator and a visiting seminarian, and a WhatsApp
 *      link gets forwarded to whoever. Only the rendering side knows.
 *   2. Error copy becomes translatable like any other string, instead of a
 *      second vocabulary hidden in `.ts` files.
 *   3. The set of failures becomes a closed, typed list. A new failure mode
 *      cannot ship without a matching entry in the catalog.
 */

export const ERROR_CODES = {
  // Session and access
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  FORBIDDEN: "FORBIDDEN",

  // Sign in / sign up
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_CONFIRMED: "EMAIL_NOT_CONFIRMED",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  INVALID_EMAIL: "INVALID_EMAIL",
  PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT",
  PASSWORDS_DO_NOT_MATCH: "PASSWORDS_DO_NOT_MATCH",
  DISPLAY_NAME_REQUIRED: "DISPLAY_NAME_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  AUTH_FAILED: "AUTH_FAILED",

  // Groups and membership
  GROUP_NAME_TOO_SHORT: "GROUP_NAME_TOO_SHORT",
  GROUP_CREATE_FAILED: "GROUP_CREATE_FAILED",
  GROUP_SAVE_FAILED: "GROUP_SAVE_FAILED",
  ALREADY_IN_A_GROUP: "ALREADY_IN_A_GROUP",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  INVALID_ROLE: "INVALID_ROLE",
  LAST_ADMIN: "LAST_ADMIN",
  ROLE_CHANGE_FAILED: "ROLE_CHANGE_FAILED",
  MEMBER_REMOVE_FAILED: "MEMBER_REMOVE_FAILED",

  // Invitations
  INVITE_CREATE_FAILED: "INVITE_CREATE_FAILED",
  INVITE_NOT_FOUND: "INVITE_NOT_FOUND",
  INVITE_ALREADY_USED: "INVITE_ALREADY_USED",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_REVOKE_FAILED: "INVITE_REVOKE_FAILED",
  JOIN_FAILED: "JOIN_FAILED",
  FILL_MEMBERS_ONLY: "FILL_MEMBERS_ONLY",
  SWAP_NEEDS_OWN_NAME: "SWAP_NEEDS_OWN_NAME",
  RELEASE_NEEDS_OWN_NAME: "RELEASE_NEEDS_OWN_NAME",
  FEEDBACK_TOO_SHORT: "FEEDBACK_TOO_SHORT",
  FEEDBACK_TOO_LONG: "FEEDBACK_TOO_LONG",
  FEEDBACK_SEND_FAILED: "FEEDBACK_SEND_FAILED",
  NOT_SUPERADMIN: "NOT_SUPERADMIN",
  JOIN_LINK_CREATE_FAILED: "JOIN_LINK_CREATE_FAILED",
  JOIN_LINK_SAVE_FAILED: "JOIN_LINK_SAVE_FAILED",
  JOIN_LINK_NOT_FOUND: "JOIN_LINK_NOT_FOUND",
  JOIN_LINK_INACTIVE: "JOIN_LINK_INACTIVE",
  JOIN_LINK_EXPIRED: "JOIN_LINK_EXPIRED",
  JOIN_LINK_EXHAUSTED: "JOIN_LINK_EXHAUSTED",
  JOIN_CODE_REQUIRED: "JOIN_CODE_REQUIRED",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  ACCOUNT_ALREADY_MEMBER: "ACCOUNT_ALREADY_MEMBER",

  // Locations
  LOCATION_NAME_TOO_SHORT: "LOCATION_NAME_TOO_SHORT",
  LOCATION_DUPLICATE: "LOCATION_DUPLICATE",
  LOCATION_SAVE_FAILED: "LOCATION_SAVE_FAILED",
  LOCATION_IN_USE: "LOCATION_IN_USE",
  LOCATION_DELETE_FAILED: "LOCATION_DELETE_FAILED",
  INVALID_COLOR: "INVALID_COLOR",

  // Weekly template
  TEMPLATE_LOCATION_REQUIRED: "TEMPLATE_LOCATION_REQUIRED",
  TEMPLATE_INVALID_TIME: "TEMPLATE_INVALID_TIME",
  TEMPLATE_DUPLICATE: "TEMPLATE_DUPLICATE",
  TEMPLATE_SAVE_FAILED: "TEMPLATE_SAVE_FAILED",
  TEMPLATE_DELETE_FAILED: "TEMPLATE_DELETE_FAILED",

  // People
  PERSON_NAME_REQUIRED: "PERSON_NAME_REQUIRED",
  PERSON_DUPLICATE: "PERSON_DUPLICATE",
  PERSON_SAVE_FAILED: "PERSON_SAVE_FAILED",
  PERSON_DELETE_FAILED: "PERSON_DELETE_FAILED",
  PERSON_NOT_FOUND: "PERSON_NOT_FOUND",
  PERSON_ALREADY_CLAIMED: "PERSON_ALREADY_CLAIMED",
  PERSON_CLAIM_FAILED: "PERSON_CLAIM_FAILED",
  PERSON_UNLINK_FAILED: "PERSON_UNLINK_FAILED",
  IMPORT_EMPTY: "IMPORT_EMPTY",
  IMPORT_TOO_MANY: "IMPORT_TOO_MANY",
  IMPORT_FAILED: "IMPORT_FAILED",

  // Schedules
  SCHEDULE_MONTH_REQUIRED: "SCHEDULE_MONTH_REQUIRED",
  SCHEDULE_TITLE_TOO_SHORT: "SCHEDULE_TITLE_TOO_SHORT",
  SCHEDULE_CREATE_FAILED: "SCHEDULE_CREATE_FAILED",
  SCHEDULE_SAVE_FAILED: "SCHEDULE_SAVE_FAILED",
  SCHEDULE_NOT_FOUND: "SCHEDULE_NOT_FOUND",
  SCHEDULE_STATUS_FAILED: "SCHEDULE_STATUS_FAILED",
  SCHEDULE_DELETE_FAILED: "SCHEDULE_DELETE_FAILED",
  SCHEDULE_PUBLISH_FAILED: "SCHEDULE_PUBLISH_FAILED",
  SCHEDULE_OTHER_GROUP: "SCHEDULE_OTHER_GROUP",

  // Celebrations
  EVENT_LOCATION_REQUIRED: "EVENT_LOCATION_REQUIRED",
  EVENT_INVALID_DATE: "EVENT_INVALID_DATE",
  EVENT_INVALID_TIME: "EVENT_INVALID_TIME",
  EVENT_DUPLICATE: "EVENT_DUPLICATE",
  EVENT_SAVE_FAILED: "EVENT_SAVE_FAILED",
  EVENT_DELETE_FAILED: "EVENT_DELETE_FAILED",
  EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
  NOVENA_TITLE_REQUIRED: "NOVENA_TITLE_REQUIRED",
  NOVENA_DAYS_TAKEN: "NOVENA_DAYS_TAKEN",
  NOVENA_CREATE_FAILED: "NOVENA_CREATE_FAILED",

  // Assembling
  ASSIGN_FAILED: "ASSIGN_FAILED",
  UNASSIGN_FAILED: "UNASSIGN_FAILED",
  AUTOFILL_FAILED: "AUTOFILL_FAILED",

  // Public fill links
  INVALID_LINK: "INVALID_LINK",
  FILL_CLOSED_DEADLINE: "FILL_CLOSED_DEADLINE",
  FILL_CLOSED_STATUS: "FILL_CLOSED_STATUS",
  NAME_LOCKED_TO_ACCOUNT: "NAME_LOCKED_TO_ACCOUNT",
  NO_VALID_CELEBRATION: "NO_VALID_CELEBRATION",
  AVAILABILITY_SAVE_FAILED: "AVAILABILITY_SAVE_FAILED",
  SLOT_TAKEN: "SLOT_TAKEN",
  SLOT_DOES_NOT_EXIST: "SLOT_DOES_NOT_EXIST",
  ALREADY_IN_CELEBRATION: "ALREADY_IN_CELEBRATION",
  CLAIM_SLOT_FAILED: "CLAIM_SLOT_FAILED",
  RELEASE_SLOT_FAILED: "RELEASE_SLOT_FAILED",
  COORDINATOR_ASSIGNS_THIS: "COORDINATOR_ASSIGNS_THIS",

  // Swaps
  SWAP_NOT_FOUND: "SWAP_NOT_FOUND",
  SWAP_ALREADY_FILLED: "SWAP_ALREADY_FILLED",
  SWAP_CANCELLED: "SWAP_CANCELLED",
  SWAP_NOT_OPEN: "SWAP_NOT_OPEN",
  SWAP_IN_THE_PAST: "SWAP_IN_THE_PAST",
  SWAP_OWN_REQUEST: "SWAP_OWN_REQUEST",
  SWAP_ONLY_OWN_MASS: "SWAP_ONLY_OWN_MASS",
  SWAP_ONLY_OWN_REQUEST: "SWAP_ONLY_OWN_REQUEST",
  SWAP_OPEN_FAILED: "SWAP_OPEN_FAILED",
  SWAP_ACCEPT_FAILED: "SWAP_ACCEPT_FAILED",

  // Generic
  INVALID_REQUEST: "INVALID_REQUEST",
  UNEXPECTED: "UNEXPECTED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Values interpolated into the translated sentence (counts, names, dates). */
export type ErrorParams = Record<string, string | number>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; code: ErrorCode; params?: ErrorParams };

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, params?: ErrorParams): ActionResult<never> {
  return { ok: false, code, params };
}

/**
 * Maps a Supabase Auth message to a code.
 *
 * Auth messages arrive as English prose from a service we do not control, so
 * this is a translation boundary, not a vocabulary of our own. Anything
 * unrecognised becomes AUTH_FAILED rather than leaking a raw provider string
 * into the interface.
 */
export function authErrorCode(message: string): ErrorCode {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return ERROR_CODES.INVALID_CREDENTIALS;
  if (m.includes("email not confirmed")) return ERROR_CODES.EMAIL_NOT_CONFIRMED;
  if (m.includes("user already registered")) return ERROR_CODES.EMAIL_ALREADY_REGISTERED;
  if (m.includes("password should be at least")) return ERROR_CODES.PASSWORD_TOO_SHORT;
  if (m.includes("rate limit") || m.includes("too many")) return ERROR_CODES.RATE_LIMITED;
  return ERROR_CODES.AUTH_FAILED;
}

/**
 * Reads the code a Zod schema carried in its `message` slot.
 *
 * Zod wants a string there, so schemas are written as
 * `z.string().min(3, ERROR_CODES.GROUP_NAME_TOO_SHORT)` - the field keeps its
 * validation next to its definition, and the code travels out untouched.
 */
export function zodErrorCode(message: string | undefined): ErrorCode {
  const known = (Object.values(ERROR_CODES) as string[]).includes(message ?? "");
  return known ? (message as ErrorCode) : ERROR_CODES.INVALID_REQUEST;
}
