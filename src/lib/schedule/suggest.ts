import type { PersonLite } from "@/lib/schedule/types";

/**
 * Números por pessoa que alimentam a sugestão. Vêm de uma query só, agregada
 * no servidor — ver `lib/schedule/queries.ts`.
 */
export interface PersonStats {
  /** Escalas já dadas a ela nesta escala (mês em montagem). */
  monthCount: number;
  /** Escalas nos últimos 90 dias, contando meses anteriores. */
  recentCount: number;
  /** Quantas vezes serviu neste local, historicamente. */
  locationCount: number;
  /** Dias desde a última vez que serviu; null = nunca serviu. */
  daysSinceLast: number | null;
  /** Quantas celebrações marcou como disponível nesta escala. */
  availabilityCount: number;
}

export interface Suggestion {
  person: PersonLite;
  score: number;
  available: boolean;
  /** Já está escalada em outra celebração no mesmo dia. */
  sameDayConflict: boolean;
  /** O conflito do dia veio de outra escala (ex.: a novena avulsa). */
  otherScheduleConflict: boolean;
  /** Já está escalada nesta celebração. */
  alreadyInEvent: boolean;
  reasons: string[];
}

const EMPTY_STATS: PersonStats = {
  monthCount: 0,
  recentCount: 0,
  locationCount: 0,
  daysSinceLast: null,
  availabilityCount: 0,
};

/**
 * Ordena candidatos para uma vaga. Não escala ninguém: só decide quem aparece
 * primeiro na lista do coordenador.
 *
 * O peso maior é o equilíbrio dentro do mês — é a queixa real, uns servem
 * cinco vezes e outros nenhuma. Afinidade com o local entra como desempate
 * leve, para não cristalizar "fulano é do São Jorge".
 */
export function rankCandidates({
  people,
  statsById,
  availableIds,
  sameDayIds,
  otherScheduleDayIds,
  eventPersonIds,
  includeUnavailable = false,
}: {
  people: PersonLite[];
  statsById: Map<string, PersonStats>;
  availableIds: Set<string>;
  sameDayIds: Set<string>;
  /** Ocupados no mesmo dia por outra escala da paróquia. */
  otherScheduleDayIds?: Set<string>;
  eventPersonIds: Set<string>;
  includeUnavailable?: boolean;
}): Suggestion[] {
  const out: Suggestion[] = [];

  for (const person of people) {
    if (!person.active) continue;
    const available = availableIds.has(person.id);
    if (!available && !includeUnavailable) continue;

    const s = statsById.get(person.id) ?? EMPTY_STATS;
    const alreadyInEvent = eventPersonIds.has(person.id);
    const otherScheduleConflict =
      !alreadyInEvent && !!otherScheduleDayIds?.has(person.id);
    const sameDayConflict =
      !alreadyInEvent && (sameDayIds.has(person.id) || otherScheduleConflict);

    let score = 100;
    const reasons: string[] = [];

    // Equilíbrio no mês — o peso dominante.
    score -= s.monthCount * 14;
    reasons.push(
      s.monthCount === 0
        ? "sem escala este mês"
        : `${s.monthCount} ${s.monthCount === 1 ? "escala" : "escalas"} este mês`,
    );

    // Histórico recente, peso menor.
    score -= s.recentCount * 3;

    // Quem some há tempo sobe; quem serviu ontem desce.
    if (s.daysSinceLast === null) {
      score += 18;
      reasons.push("nunca serviu");
    } else if (s.daysSinceLast > 45) {
      score += 12;
      reasons.push(`última vez há ${s.daysSinceLast} dias`);
    } else if (s.daysSinceLast <= 7) {
      score -= 8;
    }

    // Afinidade com o local — desempate leve.
    if (s.locationCount > 0) {
      score += Math.min(s.locationCount, 5) * 2;
      reasons.push(`serviu aqui ${s.locationCount}×`);
    } else {
      reasons.push("nunca serviu aqui");
    }

    // Quem deu pouca disponibilidade tem menos chance de ser aproveitado
    // depois: priorizar enquanto dá.
    if (available && s.availabilityCount > 0 && s.availabilityCount <= 3) {
      score += 10;
      reasons.push("deu poucas datas");
    }

    if (!available) {
      score -= 200;
      reasons.unshift("não marcou disponibilidade");
    }
    if (sameDayConflict) {
      score -= 400;
      reasons.unshift(
        otherScheduleConflict
          ? "já escalada em outra escala neste dia"
          : "já escalada neste dia",
      );
    }
    if (alreadyInEvent) {
      score -= 1000;
      reasons.unshift("já está nesta celebração");
    }

    out.push({
      person,
      score,
      available,
      sameDayConflict,
      otherScheduleConflict,
      alreadyInEvent,
      reasons,
    });
  }

  return out.sort(
    (a, b) => b.score - a.score || a.person.full_name.localeCompare(b.person.full_name, "pt-BR"),
  );
}

/**
 * Preenche de uma vez as vagas vazias de uma celebração com os melhores
 * candidatos. O coordenador revisa depois — é um atalho, não automação.
 */
export function autoFillEvent({
  suggestions,
  emptyPositions,
}: {
  suggestions: Suggestion[];
  emptyPositions: number[];
}): Array<{ position: number; personId: string }> {
  const picks: Array<{ position: number; personId: string }> = [];
  const used = new Set<string>();

  for (const position of emptyPositions) {
    const next = suggestions.find(
      (s) =>
        s.available &&
        !s.alreadyInEvent &&
        !s.sameDayConflict &&
        !used.has(s.person.id),
    );
    if (!next) break;
    used.add(next.person.id);
    picks.push({ position, personId: next.person.id });
  }

  return picks;
}
