/** Display formatting helpers shared across client + server components. */

/** Format a cash price like 571164 -> "$571,164". */
export function formatCash(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return `$${value.toLocaleString('en-US')}`;
}

/** Format Blockbux like 3170 -> "B$3,170". */
export function formatBlockbux(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  return `B$${value.toLocaleString('en-US')}`;
}

/** Relative time like "Uploaded 1 day ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let value = seconds;
  let unit = 'second';
  for (const [factor, name] of units) {
    if (value < factor) {
      unit = name;
      break;
    }
    value = Math.floor(value / factor);
    unit = name;
  }
  const rounded = Math.max(1, value);
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
}
