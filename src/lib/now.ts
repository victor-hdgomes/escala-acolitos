/**
 * Leitura do relógio isolada num módulo próprio.
 *
 * Server Components legitimamente leem a hora durante a renderização — cada
 * request é uma renderização nova. As regras do React Compiler tratam
 * `Date.now()` no corpo de um componente como impureza, então a chamada mora
 * aqui e os componentes pedem a hora por função nomeada, o que também deixa
 * explícito onde o tempo entra no cálculo.
 */

export function nowMs(): number {
  return Date.now();
}

export function nowDate(): Date {
  return new Date(nowMs());
}

/** Instante daqui a `days` dias — usado pelo lembrete de véspera. */
export function daysFromNow(days: number): Date {
  return new Date(nowMs() + days * 86_400_000);
}

export function isPast(iso: string): boolean {
  return Date.parse(iso) < nowMs();
}

export function daysSince(iso: string): number {
  return Math.floor((nowMs() - Date.parse(iso)) / 86_400_000);
}
