/** Small numerical kit for the four studies. Seeded, dependency-free. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function sampleStd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) * (x - m);
  return Math.sqrt(v / (xs.length - 1));
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

/**
 * Standard normal CDF. Hart's rational approximation as given by West (2005),
 * "Better approximations to cumulative normal functions", accurate to about
 * 1e-14 across the whole line, so finite-difference Greeks agree with the
 * closed form to many digits.
 */
export function normalCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) {
    c = 0;
  } else {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let build = 3.52624965998911e-2 * z + 0.700383064443688;
      build = build * z + 6.37396220353165;
      build = build * z + 33.912866078383;
      build = build * z + 112.079291497871;
      build = build * z + 221.213596169931;
      build = build * z + 220.206867912376;
      c = e * build;
      build = 8.83883476483184e-2 * z + 1.75566716318264;
      build = build * z + 16.064177579207;
      build = build * z + 86.7807322029461;
      build = build * z + 296.564248779674;
      build = build * z + 637.333633378831;
      build = build * z + 793.826512519948;
      build = build * z + 440.413735824752;
      c = c / build;
    } else {
      let build = z + 0.65;
      build = z + 4 / build;
      build = z + 3 / build;
      build = z + 2 / build;
      build = z + 1 / build;
      c = e / build / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/** Error function, derived from the CDF above: erf(x) = 2 Φ(x√2) − 1. */
export function erf(x: number): number {
  return 2 * normalCdf(x * Math.SQRT2) - 1;
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export function zeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array<number>(cols).fill(0));
}

export function matVec(m: number[][], v: number[]): number[] {
  return m.map((row) => dot(row, v));
}

export function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const m = matrix.map((row, i) => {
    const out = row.slice();
    for (let j = 0; j < n; j++) out.push(i === j ? 1 : 0);
    return out;
  });
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) {
      throw new Error("Singular matrix");
    }
    const tmp = m[col]!;
    m[col] = m[pivot]!;
    m[pivot] = tmp;
    const div = m[col]![col]!;
    for (let j = 0; j < 2 * n; j++) m[col]![j] = m[col]![j]! / div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]!;
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r]![j] = m[r]![j]! - f * m[col]![j]!;
    }
  }
  return m.map((row) => row.slice(n));
}

export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i]![k]! * L[j]![k]!;
      if (i === j) {
        L[i]![j] = Math.sqrt(Math.max(matrix[i]![i]! - sum, 0));
      } else {
        const diag = L[j]![j]!;
        L[i]![j] = diag === 0 ? 0 : (matrix[i]![j]! - sum) / diag;
      }
    }
  }
  return L;
}

export function npv(rate: number, cashflows: number[]): number {
  let s = 0;
  let disc = 1;
  for (let t = 0; t < cashflows.length; t++) {
    s += cashflows[t]! / disc;
    disc *= 1 + rate;
  }
  return s;
}

export function signChanges(cashflows: number[]): number {
  let changes = 0;
  let prev = 0;
  for (const cf of cashflows) {
    if (cf === 0) continue;
    if (prev !== 0 && prev * cf < 0) changes += 1;
    prev = cf;
  }
  return changes;
}

/** Bisection IRR. Null if no sign-changing root in (-0.85, 4). */
export function irr(cashflows: number[]): number | null {
  const f = (r: number) => npv(r, cashflows);
  let lo = -0.85;
  let hi = 4;
  let flo = f(lo);
  let fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function mirr(
  cashflows: number[],
  financeRate: number,
  reinvestRate: number,
): number | null {
  const n = cashflows.length - 1;
  if (n <= 0) return null;
  let pvNeg = 0;
  let fvPos = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const cf = cashflows[t]!;
    if (cf < 0) pvNeg += cf / (1 + financeRate) ** t;
    else fvPos += cf * (1 + reinvestRate) ** (n - t);
  }
  if (pvNeg >= 0 || fvPos <= 0) return null;
  return (fvPos / -pvNeg) ** (1 / n) - 1;
}

export function payback(cashflows: number[]): number | null {
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const prev = acc;
    acc += cashflows[t]!;
    if (t > 0 && prev < 0 && acc >= 0) {
      const cf = cashflows[t]!;
      if (cf === 0) return t;
      return t - 1 + -prev / cf;
    }
  }
  return acc >= 0 ? 0 : null;
}

export type Ols = {
  beta: number[];
  se: number[];
  t: number[];
  r2: number;
  adjR2: number;
  n: number;
  k: number;
  sigma: number;
};

/** OLS of y on X. X is n × k and already includes a constant column if wanted. */
export function ols(y: number[], X: number[][]): Ols {
  const n = y.length;
  const k = X[0]?.length ?? 0;
  if (n === 0 || k === 0 || n <= k) {
    throw new Error("OLS needs more rows than columns");
  }
  const xtx = zeros(k, k);
  const xty = Array<number>(k).fill(0);
  for (let i = 0; i < n; i++) {
    const row = X[i]!;
    const yi = y[i]!;
    for (let a = 0; a < k; a++) {
      xty[a] = xty[a]! + row[a]! * yi;
      for (let b = 0; b < k; b++) xtx[a]![b] = xtx[a]![b]! + row[a]! * row[b]!;
    }
  }
  const inv = invert(xtx);
  const beta = matVec(inv, xty);
  let ssr = 0;
  let sst = 0;
  const ybar = mean(y);
  for (let i = 0; i < n; i++) {
    const fitted = dot(X[i]!, beta);
    const e = y[i]! - fitted;
    ssr += e * e;
    const d = y[i]! - ybar;
    sst += d * d;
  }
  const dof = n - k;
  const sigma2 = ssr / dof;
  const se = beta.map((_, j) => Math.sqrt(Math.max(0, sigma2 * inv[j]![j]!)));
  const t = beta.map((b, j) => (se[j] === 0 ? 0 : b / se[j]!));
  const r2 = sst === 0 ? 1 : 1 - ssr / sst;
  const adjR2 = 1 - (1 - r2) * ((n - 1) / dof);
  return { beta, se, t, r2, adjR2, n, k, sigma: Math.sqrt(sigma2) };
}

/**
 * Euclidean projection onto { w | sum w = 1, 0 ≤ w_i ≤ cap }.
 * Tau is found by bisection; infeasible caps are lifted to 1/n.
 */
export function projectCappedSimplex(v: number[], cap: number): number[] {
  const n = v.length;
  const c = Math.max(cap, 1 / n + 1e-9);
  let lo = Math.min(...v) - c;
  let hi = Math.max(...v);
  for (let i = 0; i < 70; i++) {
    const tau = (lo + hi) / 2;
    let s = 0;
    for (let j = 0; j < n; j++) s += clamp(v[j]! - tau, 0, c);
    if (s > 1) lo = tau;
    else hi = tau;
  }
  const tau = (lo + hi) / 2;
  const w = v.map((x) => clamp(x - tau, 0, c));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) return Array<number>(n).fill(1 / n);
  return w.map((x) => x / sum);
}

export function histogram(
  values: number[],
  bins: number,
): { x: number; count: number; neg: boolean }[] {
  if (values.length === 0) return [];
  let lo = values[0]!;
  let hi = values[0]!;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) {
    return [{ x: lo, count: values.length, neg: lo < 0 }];
  }
  const width = (hi - lo) / bins;
  const counts = Array<number>(bins).fill(0);
  for (const v of values) {
    let i = Math.floor((v - lo) / width);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    counts[i] = counts[i]! + 1;
  }
  return counts.map((count, i) => {
    const x = lo + (i + 0.5) * width;
    return { x, count, neg: x < 0 };
  });
}
