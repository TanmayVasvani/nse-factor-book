export function inrCr(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}₹${Math.abs(n).toFixed(digits)} cr`;
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}${(Math.abs(n) * 100).toFixed(digits)}%`;
}

export function num(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

export function rupees(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}₹${Math.abs(n).toFixed(digits)}`;
}

export function years(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "Beyond year 5";
  return `${n.toFixed(digits)} yrs`;
}

export function intish(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-IN");
}
