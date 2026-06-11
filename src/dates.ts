// Dates are handled as plain YYYY-MM-DD strings in UTC. The lesson cares about
// calendar days, not clock time, so this avoids timezone drift entirely.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return toDateString(new Date());
}

export function addDays(dateString: string, days: number): string {
  const ms = Date.parse(`${dateString}T00:00:00Z`);
  return toDateString(new Date(ms + days * MS_PER_DAY));
}

// Negative when `a` is before `b`, positive when after, 0 when same day.
export function compareDates(a: string, b: string): number {
  return Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
}
