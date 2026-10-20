import {
  formatFullDate,
  formatShortDate,
  formatTime,
  monthLabel,
  weekdayLong,
} from "@/lib/date";
import type { ScheduleKind } from "@/lib/db/types";
import type { DayGroup, EventView, ScheduleDetail } from "@/lib/schedule/types";

export function personLabel(p: {
  full_name: string;
  short_name: string | null;
}): string {
  return p.short_name?.trim() || p.full_name;
}

function namesOf(event: EventView): string[] {
  return event.slotsView
    .filter((s) => s.person)
    .map((s) => personLabel(s.person!));
}

/**
 * Numa escala de novena o título já diz qual devoção é; repetir o nome em
 * cada um dos nove dias só faz a mensagem crescer. "1º dia da Novena em honra
 * a X" vira "1º dia".
 */
function eventLabel(
  label: string | null,
  schedule: { title: string; kind?: ScheduleKind },
): string | null {
  if (!label || schedule.kind !== "novena") return label;
  const suffix = ` da ${schedule.title}`;
  return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
}

/**
 * A mensagem que abre o preenchimento — o equivalente ao "Bom dia, pessoal"
 * que o coordenador manda hoje no grupo com o link do Google Forms.
 */
export function buildInviteMessage({
  schedule,
  url,
  deadlineLabel,
  hasNovena,
}: {
  schedule: { title: string; month: string; kind?: ScheduleKind };
  url: string;
  deadlineLabel: string | null;
  hasNovena: boolean;
}): string {
  const isNovena = schedule.kind === "novena";
  const lines = [
    "Bom dia, pessoal! 🙏",
    "",
    isNovena
      ? `Está aberta a escala da ${schedule.title}. Deixo o link para nos organizarmos:`
      : `Está aberta a escala de ${monthLabel(schedule.month).toLowerCase()}. Deixo o link para que possamos nos organizar com calma:`,
    "",
    url,
    "",
  ];
  // Só vale avisar quando a novena está dentro da escala do mês; se ela tem
  // escala própria, este link já é o dela.
  if (hasNovena && !isNovena) {
    lines.push(
      "A escala da novena está nesse mesmo link, podem preencher tudo junto.",
      "",
    );
  }
  if (deadlineLabel) {
    lines.push(`⏰ Preenchimento disponível até ${deadlineLabel}.`);
  }
  lines.push(
    "",
    isNovena
      ? "Basta abrir, escolher o seu nome e pegar o dia que puder."
      : "Basta abrir, escolher o seu nome e marcar as datas.",
  );
  return lines.join("\n");
}

/** Mensagem de escala publicada. */
export function buildPublishedMessage({
  schedule,
  url,
}: {
  schedule: { title: string; month: string; kind?: ScheduleKind };
  url: string;
}): string {
  return [
    schedule.kind === "novena"
      ? `✅ *${schedule.title.toUpperCase()}* — escala publicada!`
      : `✅ *ESCALA DE ${monthLabel(schedule.month).toUpperCase()}* publicada!`,
    "",
    "Confiram onde cada um está servindo:",
    url,
    "",
    "Quem não puder em alguma data, peça substituição pelo próprio link.",
  ].join("\n");
}

/**
 * A escala inteira em texto, agrupada por dia. WhatsApp não renderiza tabela,
 * então a tabela de colunas do documento vira lista — mais longa, porém
 * legível no celular, que é onde isso é lido.
 */
export function buildScheduleText(detail: ScheduleDetail): string {
  const { schedule, timezone, days } = detail;
  const out: string[] = [
    schedule.kind === "monthly"
      ? `*ESCALA MINISTÉRIO DE ACÓLITOS — ${monthLabel(schedule.month).toUpperCase()}*`
      : `*${schedule.title.toUpperCase()}*`,
    "",
  ];

  for (const day of days) {
    const first = day.events[0];
    if (!first) continue;
    out.push(
      `*${weekdayLong(first.starts_at, timezone)}, ${formatShortDate(first.starts_at, timezone)}*`,
    );
    for (const ev of day.events) {
      const names = namesOf(ev);
      out.push(
        `• ${formatTime(ev.starts_at, timezone)} — ${ev.location.name}${
          eventLabel(ev.label, schedule) ? ` (${eventLabel(ev.label, schedule)})` : ""
        }`,
      );
      out.push(names.length ? `  ${names.join(", ")}` : "  _sem acólitos_");
    }
    out.push("");
  }

  return out.join("\n").trimEnd();
}

/**
 * O formato de novena que o grupo já usa, com as vagas numeradas e as vazias
 * explícitas — é o que deixa claro o que falta preencher.
 */
export function buildNovenaText({
  title,
  events,
  timezone,
}: {
  title: string;
  events: EventView[];
  timezone: string;
}): string {
  const out: string[] = [`*${title.toUpperCase()}*`, ""];

  for (const ev of events) {
    out.push(
      `- ${weekdayLong(ev.starts_at, timezone)}, ${formatShortDate(ev.starts_at, timezone)} às ${formatTime(ev.starts_at, timezone)}`,
    );
    for (let i = 1; i <= ev.slots; i++) {
      const slot = ev.slotsView.find((s) => s.position === i);
      out.push(`${i}- ${slot?.person ? personLabel(slot.person) : ""}`);
    }
  }

  return out.join("\n");
}

/** Pedido de substituição pronto para colar no grupo. */
export function buildSwapMessage({
  personName,
  event,
  timezone,
  url,
  reason,
}: {
  personName: string;
  event: { starts_at: string; locationName: string };
  timezone: string;
  url: string;
  reason?: string | null;
}): string {
  const when = `${weekdayLong(event.starts_at, timezone)}, ${formatShortDate(event.starts_at, timezone)} às ${formatTime(event.starts_at, timezone)}`;
  return [
    `🔄 *Preciso de substituição*`,
    "",
    `${personName} não vai conseguir servir ${when}, em ${event.locationName}.`,
    reason ? `Motivo: ${reason}` : "",
    "",
    "Quem puder assumir, é só abrir e confirmar:",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Cobrança de quem ainda não respondeu. */
export function buildReminderMessage({
  url,
  pendingNames,
  deadlineLabel,
}: {
  url: string;
  pendingNames: string[];
  deadlineLabel: string | null;
}): string {
  return [
    "⏰ *Faltam vocês na escala*",
    "",
    pendingNames.length
      ? `Ainda não marcaram disponibilidade: ${pendingNames.join(", ")}.`
      : "Ainda falta gente marcar disponibilidade.",
    "",
    deadlineLabel ? `O preenchimento fecha ${deadlineLabel}.` : "",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * CSV no formato da planilha atual: uma linha por celebração, uma coluna por
 * vaga. É o que permite colar o resultado onde o ministério já usa.
 */
export function buildScheduleCsv(detail: ScheduleDetail): string {
  const { timezone, days } = detail;
  const maxSlots = Math.max(
    1,
    ...days.flatMap((d) => d.events.map((e) => e.slots)),
  );

  const header = [
    "DATA",
    "DIA DA SEMANA",
    "HORA",
    "LOCAL",
    ...Array.from({ length: maxSlots }, () => "ACÓLITO"),
  ];

  const rows = days.flatMap((day: DayGroup) =>
    day.events.map((ev) => {
      const names = ev.slotsView
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => (s.person ? personLabel(s.person) : ""));
      return [
        formatFullDate(ev.starts_at, timezone),
        weekdayLong(ev.starts_at, timezone).toUpperCase(),
        formatTime(ev.starts_at, timezone).toUpperCase(),
        eventLabel(ev.label, detail.schedule)
          ? `${ev.location.name} — ${eventLabel(ev.label, detail.schedule)}`
          : ev.location.name,
        ...Array.from({ length: maxSlots }, (_, i) => names[i] ?? ""),
      ];
    }),
  );

  return [header, ...rows]
    .map((cols) => cols.map(csvCell).join(";"))
    .join("\r\n");
}

function csvCell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
