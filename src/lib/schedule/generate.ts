import { civilWeekday, daysOfMonth, zonedTimeToUtc } from "@/lib/date";
import type { MassTemplate } from "@/lib/db/types";
import type { EventDraft } from "@/lib/schedule/types";

/**
 * Projeta a grade semanal sobre um mês.
 *
 * O coordenador sempre ajusta o resultado (novena, solenidade, missa que não
 * houve), então isto é só o ponto de partida — nunca a palavra final.
 */
export function generateMonthEvents(
  monthIso: string,
  templates: MassTemplate[],
  timeZone: string,
): EventDraft[] {
  const active = templates.filter((t) => t.active);
  const drafts: EventDraft[] = [];

  for (const [year, month, day] of daysOfMonth(monthIso)) {
    const weekday = civilWeekday(year, month, day);
    for (const t of active) {
      if (t.weekday !== weekday) continue;
      const [h, m] = t.start_time.split(":").map(Number);
      drafts.push({
        location_id: t.location_id,
        starts_at: zonedTimeToUtc(year, month, day, h, m ?? 0, timeZone).toISOString(),
        slots: t.slots,
        kind: "mass",
        signup_mode: "availability",
        label: t.label,
      });
    }
  }

  return drafts.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/**
 * Dias de uma novena a partir do primeiro dia: nove celebrações seguidas, no
 * mesmo local e horário. É assim que o ministério faz hoje.
 */
export function generateNovenaEvents({
  title,
  locationId,
  firstDay,
  hour,
  minute,
  slots,
  timeZone,
  days = 9,
}: {
  title: string;
  locationId: string;
  firstDay: string; // "2026-11-13"
  hour: number;
  minute: number;
  slots: number;
  timeZone: string;
  days?: number;
}): EventDraft[] {
  const [y, m, d] = firstDay.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => {
    const civil = new Date(Date.UTC(y, m - 1, d + i));
    return {
      location_id: locationId,
      starts_at: zonedTimeToUtc(
        civil.getUTCFullYear(),
        civil.getUTCMonth() + 1,
        civil.getUTCDate(),
        hour,
        minute,
        timeZone,
      ).toISOString(),
      slots,
      kind: "novena" as const,
      // Novena é preenchimento direto: quem quer, pega a vaga.
      signup_mode: "direct" as const,
      label: `${i + 1}º dia da ${title}`,
    };
  });
}
