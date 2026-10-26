import "server-only";

import type { DateFormatter } from "@/lib/date";
import { monthForms } from "@/lib/schedule/format";
import type { Translate } from "@/lib/schedule/types";

/**
 * The e-mails the app sends.
 *
 * Like the WhatsApp builders, these compose text on the server for someone who
 * is not the reader of the current request - the nightly reminder writes to a
 * whole parish at once. So the caller binds the language and the parish clock
 * and passes them in: `getTranslations("emails")` (or
 * `getTranslations({ locale, namespace: "emails" })` in the cron) and
 * `getDateFormatter(timezone)`.
 */
interface MailContext {
  t: Translate;
  df: DateFormatter;
}

export interface Mail {
  subject: string;
  html: string;
}

/**
 * Inline, table-based HTML on purpose: an e-mail client ignores much of modern
 * CSS, and Gmail on a phone is where this will be read.
 */
function layout(
  { t, df }: MailContext,
  title: string,
  body: string,
): string {
  return `<!doctype html>
<html lang="${df.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:0 4px 12px">
      <span style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#737373">${t("layout.brand")}</span>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:28px 24px">
      <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;font-weight:600;letter-spacing:-.01em">${title}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:14px 4px 0">
      <p style="margin:0;font-size:12px;line-height:1.5;color:#737373">${t("layout.footer")}</p>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0 4px"><a href="${href}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:600;font-size:15px;line-height:1">${label}</a></p>`;
}

/**
 * Everything that reaches the markup goes through here first.
 *
 * Some of these values are typed by whoever holds a public link: the reason
 * on a cover request, and a name an unclaimed row carries. Without escaping,
 * that text is written straight into HTML that the whole ministry opens in
 * their mail client.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Markup is kept out of the catalog: translators get a plain sentence. */
function strong(value: string): string {
  return `<strong>${esc(value)}</strong>`;
}

export interface MassLine {
  starts_at: string;
  locationName: string;
  label: string | null;
}

/** "Sunday, 08/11 at 7:30 PM" - the same wording the WhatsApp text uses. */
function whenOf({ t, df }: MailContext, startsAt: string): string {
  return t("when", {
    weekday: df.weekday(startsAt),
    date: df.shortDate(startsAt),
    time: df.time(startsAt),
  });
}

function massList(ctx: MailContext, items: MassLine[]): string {
  const { t } = ctx;
  if (!items.length) return `<p>${t("massList.empty")}</p>`;
  const rows = items
    .map(
      (m) =>
        `<li style="margin:0 0 10px;line-height:1.5"><strong>${whenOf(ctx, m.starts_at)}</strong><br>${
          m.label
            ? esc(
                t("massList.locationWithLabel", {
                  location: m.locationName,
                  label: m.label,
                }),
              )
            : esc(m.locationName)
        }</li>`,
    )
    .join("");
  return `<ul style="margin:0;padding-left:18px">${rows}</ul>`;
}

export function schedulePublishedEmail({
  t,
  df,
  personName,
  month,
  masses,
  url,
}: MailContext & {
  personName: string;
  month: string;
  masses: MassLine[];
  url: string;
}): Mail {
  const ctx = { t, df };
  const months = monthForms(df, month);
  return {
    subject: t("schedulePublished.subject", months),
    html: layout(
      ctx,
      esc(t("schedulePublished.heading", { person: personName, ...months })),
      `<p style="margin:0 0 12px">${t("schedulePublished.intro")}</p>
       ${massList(ctx, masses)}
       ${button(url, t("schedulePublished.cta"))}
       <p style="margin:0;font-size:13px;color:#525252">${t("schedulePublished.footer")}</p>`,
    ),
  };
}

export function reminderEmail({
  t,
  df,
  personName,
  masses,
  url,
}: MailContext & {
  personName: string;
  masses: MassLine[];
  url: string;
}): Mail {
  const ctx = { t, df };
  return {
    subject: t("reminder.subject"),
    html: layout(
      ctx,
      esc(t("reminder.heading", { person: personName })),
      `${massList(ctx, masses)}${button(url, t("reminder.cta"))}`,
    ),
  };
}

export function swapOpenedEmail({
  t,
  df,
  personName,
  requesterName,
  starts_at,
  locationName,
  url,
  reason,
}: MailContext & {
  personName: string;
  requesterName: string;
  starts_at: string;
  locationName: string;
  url: string;
  reason: string | null;
}): Mail {
  const ctx = { t, df };
  return {
    subject: t("swapOpened.subject", { requester: requesterName }),
    html: layout(
      ctx,
      esc(t("swapOpened.heading", { person: personName })),
      `<p style="margin:0 0 12px">${t("swapOpened.body", {
        requester: strong(requesterName),
        when: whenOf(ctx, starts_at),
        location: esc(locationName),
      })}</p>
       ${reason ? `<p style="margin:0 0 12px;color:#525252">${t("swapOpened.reason", { reason: esc(reason) })}</p>` : ""}
       <p style="margin:0 0 12px">${t("swapOpened.question")}</p>
       ${button(url, t("swapOpened.cta"))}`,
    ),
  };
}

export function swapFilledEmail({
  t,
  df,
  personName,
  filledByName,
  starts_at,
  locationName,
}: MailContext & {
  personName: string;
  filledByName: string;
  starts_at: string;
  locationName: string;
}): Mail {
  const ctx = { t, df };
  return {
    subject: t("swapFilled.subject"),
    html: layout(
      ctx,
      esc(t("swapFilled.heading", { person: personName })),
      `<p style="margin:0">${t("swapFilled.body", {
        filledBy: strong(filledByName),
        when: whenOf(ctx, starts_at),
        location: esc(locationName),
      })}</p>`,
    ),
  };
}

export function inviteEmail({
  t,
  df,
  parishName,
  roleLabel,
  url,
}: MailContext & {
  parishName: string;
  /** Already translated by the caller - see `common.roles` in the catalog. */
  roleLabel: string;
  url: string;
}): Mail {
  const ctx = { t, df };
  return {
    subject: t("invite.subject", { parish: parishName }),
    html: layout(
      ctx,
      esc(t("invite.heading", { parish: parishName })),
      `<p style="margin:0 0 12px">${t("invite.body", { role: strong(roleLabel) })}</p>
       ${button(url, t("invite.cta"))}
       <p style="margin:0;font-size:13px;color:#525252">${t("invite.expiry", { days: 14 })}</p>`,
    ),
  };
}
