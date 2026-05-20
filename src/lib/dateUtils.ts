const TZ_HOURS = process.env.TZ_OFFSET ? Number(process.env.TZ_OFFSET) : -new Date().getTimezoneOffset() / 60;
export const OFFSET = TZ_HOURS * 60 * 60 * 1000;

export function dateFromStr(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + OFFSET;
}

export function dateToEndTimestamp(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d + 1) + OFFSET - 1;
}
