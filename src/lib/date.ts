/**
 * Datas sempre no fuso da paróquia.
 *
 * `events.starts_at` é timestamptz (instante absoluto). Tudo que o usuário vê
 * — e tudo que agrupa por "dia" — precisa ser calculado no fuso da paróquia,
 * nunca no do servidor. Por isso nada aqui usa getDate()/getHours() direto.
 *
 * Usa Intl em vez de date-fns-tz: o conjunto de operações é pequeno e assim
 * não entra mais uma dependência só para converter fuso.
 */

export const WEEKDAYS_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const WEEKDAYS_SHORT = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Partes do instante já convertidas para o fuso pedido. */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = domingo
}

function partsIn(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    wdName,
  );
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    // Algumas implementações devolvem "24" para meia-noite.
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

export function zonedParts(date: Date | string, timeZone: string): ZonedParts {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = partsIn(d, timeZone);
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    minute: p.minute,
    weekday: p.weekday,
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - date.getTime();
}

/**
 * Hora de parede no fuso da paróquia → instante UTC.
 * Faz duas passadas porque o offset depende da própria data (horário de verão).
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(guess), timeZone);
  let result = new Date(guess - first);
  const second = offsetMs(result, timeZone);
  if (second !== first) result = new Date(guess - second);
  return result;
}

/** "2026-11-08" no fuso da paróquia — chave de agrupamento por dia. */
export function dayKey(date: Date | string, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "08h00" — o formato que o ministério já usa. */
export function formatTime(date: Date | string, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}h${String(p.minute).padStart(2, "0")}`;
}

/** "08h00" a partir de um `time` do Postgres ("08:00:00"). */
export function formatTimeString(value: string): string {
  const [h, m] = value.split(":");
  return `${h.padStart(2, "0")}h${(m ?? "00").padStart(2, "0")}`;
}

/** "08 de novembro" */
export function formatDayMonth(date: Date | string, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.day).padStart(2, "0")} de ${MONTHS_LONG[p.month - 1]}`;
}

/** "08/11" */
export function formatShortDate(date: Date | string, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;
}

/** "08/11/2026" */
export function formatFullDate(date: Date | string, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export function weekdayLong(date: Date | string, timeZone: string): string {
  return WEEKDAYS_LONG[zonedParts(date, timeZone).weekday];
}

export function weekdayShort(date: Date | string, timeZone: string): string {
  return WEEKDAYS_SHORT[zonedParts(date, timeZone).weekday];
}

/** "Novembro de 2026" — a partir de um `date` do Postgres ("2026-11-01"). */
export function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const name = MONTHS_LONG[(m ?? 1) - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

/** Todos os dias do mês, como [ano, mês, dia]. */
export function daysOfMonth(monthIso: string): Array<[number, number, number]> {
  const [year, month] = monthIso.split("-").map(Number);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => [year, month, i + 1]);
}

/** Dia da semana de uma data civil, sem passar por fuso. 0 = domingo. */
export function civilWeekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** "2026-11-01" do mês atual no fuso da paróquia. */
export function currentMonthIso(timeZone: string): string {
  const p = zonedParts(new Date(), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-01`;
}

/** Avança `delta` meses sobre um "2026-11-01". */
export function addMonths(monthIso: string, delta: number): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Período de manhã/tarde/noite, usado nos filtros rápidos do formulário. */
export function periodOf(
  date: Date | string,
  timeZone: string,
): "morning" | "afternoon" | "night" {
  const { hour } = zonedParts(date, timeZone);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "night";
}

/** "em 3 dias", "amanhã", "hoje", "há 2 dias" */
export function relativeDays(date: Date | string, timeZone: string): string {
  const target = dayKey(date, timeZone);
  const today = dayKey(new Date(), timeZone);
  const diff = Math.round(
    (Date.parse(`${target}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return diff > 0 ? `em ${diff} dias` : `há ${Math.abs(diff)} dias`;
}
