import {
  cholesky,
  dot,
  matVec,
  mean,
  mulberry32,
  ols,
  projectCappedSimplex,
  randn,
  sampleStd,
  type Ols,
} from "./stats";

export const RF_ANNUAL = 0.065;
const RF_MONTH = RF_ANNUAL / 12;
const MONTHS = 60;

export type Asset = {
  ticker: string;
  name: string;
  sector: string;
  beta: [number, number, number, number];
  alpha: number;
  idio: number;
};

/** Labels only. Returns are drawn from the factor model below, not from the NSE tape. */
export const ASSETS: Asset[] = [
  {
    ticker: "RELIANCE",
    name: "Reliance",
    sector: "Energy",
    beta: [1.05, -0.15, 0.2, 0.05],
    alpha: 0,
    idio: 0.055,
  },
  {
    ticker: "TCS",
    name: "TCS",
    sector: "IT",
    beta: [0.72, -0.32, -0.28, 0.12],
    alpha: 0.001,
    idio: 0.048,
  },
  {
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    sector: "Financials",
    beta: [1.12, -0.08, 0.38, -0.06],
    alpha: 0,
    idio: 0.05,
  },
  {
    ticker: "INFY",
    name: "Infosys",
    sector: "IT",
    beta: [0.78, -0.26, -0.3, 0.14],
    alpha: 0,
    idio: 0.05,
  },
  {
    ticker: "ITC",
    name: "ITC",
    sector: "FMCG",
    beta: [0.62, -0.05, 0.42, 0.0],
    alpha: 0,
    idio: 0.042,
  },
  {
    ticker: "HINDUNILVR",
    name: "HUL",
    sector: "FMCG",
    beta: [0.58, -0.18, 0.16, 0.04],
    alpha: 0,
    idio: 0.04,
  },
  {
    ticker: "ICICIBANK",
    name: "ICICI Bank",
    sector: "Financials",
    beta: [1.28, 0.08, 0.46, -0.08],
    alpha: 0,
    idio: 0.058,
  },
  {
    ticker: "LT",
    name: "L&T",
    sector: "Industrials",
    beta: [1.18, 0.12, 0.22, 0.18],
    alpha: 0,
    idio: 0.06,
  },
  {
    ticker: "SUNPHARMA",
    name: "Sun Pharma",
    sector: "Health",
    beta: [0.68, 0.18, -0.12, 0.06],
    alpha: 0,
    idio: 0.055,
  },
  {
    ticker: "TATAMOTORS",
    name: "Tata Motors",
    sector: "Auto",
    beta: [1.48, 0.58, 0.08, 0.32],
    alpha: 0.0015,
    idio: 0.085,
  },
];

export const FACTOR_NAMES = ["Market", "Size", "Value", "Momentum"] as const;

type Panel = {
  /** Total monthly simple returns, MONTHS × N. */
  returns: number[][];
  /** Factor realisations, MONTHS × 4, already the premia. */
  factors: number[][];
  factorMean: number[];
  regs: Ols[];
  mu: number[];
  cov: number[][];
  vols: number[];
  annReturn: number[];
  annVol: number[];
};

const FACTOR_MEAN = [0.0072, 0.0014, 0.0021, 0.0028];
const FACTOR_VOL = [0.046, 0.03, 0.028, 0.034];
const FACTOR_CORR: number[][] = [
  [1, 0.05, -0.12, -0.18],
  [0.05, 1, 0.22, 0.08],
  [-0.12, 0.22, 1, -0.2],
  [-0.18, 0.08, -0.2, 1],
];

export function buildPanel(seed: number): Panel {
  const rand = mulberry32(seed);
  const L = cholesky(FACTOR_CORR);
  const n = ASSETS.length;
  const returns: number[][] = [];
  const factors: number[][] = [];
  for (let t = 0; t < MONTHS; t++) {
    const z = [randn(rand), randn(rand), randn(rand), randn(rand)];
    const shock = matVec(L, z);
    const f = FACTOR_MEAN.map((m, i) => m + FACTOR_VOL[i]! * shock[i]!);
    factors.push(f);
    const row: number[] = [];
    for (const asset of ASSETS) {
      const systematic = dot(asset.beta, f);
      const excess = asset.alpha + systematic + asset.idio * randn(rand);
      row.push(RF_MONTH + excess);
    }
    returns.push(row);
  }

  const regs: Ols[] = [];
  for (let i = 0; i < n; i++) {
    const y = returns.map((row) => row[i]! - RF_MONTH);
    const X = factors.map((f) => [1, f[0]!, f[1]!, f[2]!, f[3]!]);
    regs.push(ols(y, X));
  }

  const monthlyMean = Array.from({ length: n }, (_, i) => mean(returns.map((row) => row[i]!)));
  const cov = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let a = 0; a < n; a++) {
    for (let b = a; b < n; b++) {
      let s = 0;
      for (let t = 0; t < MONTHS; t++) {
        s += (returns[t]![a]! - monthlyMean[a]!) * (returns[t]![b]! - monthlyMean[b]!);
      }
      const c = (s / (MONTHS - 1)) * 12;
      cov[a]![b] = c;
      cov[b]![a] = c;
    }
  }
  const annReturn = monthlyMean.map((m) => m * 12);
  const annVol = ASSETS.map((_, i) => sampleStd(returns.map((row) => row[i]!)) * Math.sqrt(12));
  const factorMean = FACTOR_MEAN.map((_, k) => mean(factors.map((f) => f[k]!)));
  return {
    returns,
    factors,
    factorMean,
    regs,
    mu: annReturn,
    cov,
    vols: annVol,
    annReturn,
    annVol,
  };
}

export const PANEL: Panel = buildPanel(2048);

export type PortStats = { ret: number; vol: number; sharpe: number };

export function portStats(
  w: number[],
  mu: number[] = PANEL.mu,
  cov: number[][] = PANEL.cov,
): PortStats {
  const ret = dot(w, mu);
  const variance = Math.max(0, dot(w, matVec(cov, w)));
  const vol = Math.sqrt(variance);
  const sharpe = vol > 1e-8 ? (ret - RF_ANNUAL) / vol : 0;
  return { ret, vol, sharpe };
}

function utility(w: number[], mu: number[], cov: number[][], lambda: number): number {
  const ret = dot(w, mu);
  const variance = dot(w, matVec(cov, w));
  return ret - 0.5 * lambda * variance;
}

/** Long-only (optional cap) mean-variance: max w′μ − (λ/2) w′Σw. */
export function optimize(lambda: number, cap: number, mu: number[] = PANEL.mu): number[] {
  const n = ASSETS.length;
  const cov = PANEL.cov;
  let w = Array<number>(n).fill(1 / n);
  let step = 0.8;
  let u = utility(w, mu, cov, lambda);
  for (let iter = 0; iter < 180; iter++) {
    const Sw = matVec(cov, w);
    const grad = mu.map((m, i) => m - lambda * Sw[i]!);
    let trial = step;
    let accepted = false;
    for (let bt = 0; bt < 14; bt++) {
      const cand = projectCappedSimplex(
        w.map((wi, i) => wi + trial * grad[i]!),
        cap,
      );
      const uc = utility(cand, mu, cov, lambda);
      if (uc >= u - 1e-12) {
        w = cand;
        u = uc;
        step = Math.min(trial * 1.15, 8);
        accepted = true;
        break;
      }
      trial *= 0.45;
    }
    if (!accepted) break;
  }
  return w;
}

export type FrontierPoint = PortStats & { lambda: number; weights: number[] };

const LAMBDAS = [0.6, 1, 1.6, 2.4, 3.5, 5, 7, 10, 14, 20, 30, 50];

export function frontier(cap: number, mu: number[] = PANEL.mu): FrontierPoint[] {
  return LAMBDAS.map((lambda) => {
    const weights = optimize(lambda, cap, mu);
    return { lambda, weights, ...portStats(weights, mu) };
  });
}

export function maxSharpe(cap: number, mu: number[] = PANEL.mu): FrontierPoint {
  const points = frontier(cap, mu);
  return points.reduce((best, p) => (p.sharpe > best.sharpe ? p : best));
}

/** Pull every sample mean toward the cross-sectional average. 0 = raw, 1 = fully shrunk. */
export function shrinkMeans(intensity: number): number[] {
  const a = Math.min(1, Math.max(0, intensity));
  const g = PANEL.mu.reduce((s, m) => s + m, 0) / PANEL.mu.length;
  return PANEL.mu.map((m) => (1 - a) * m + a * g);
}

export function equalWeight(): number[] {
  return Array<number>(ASSETS.length).fill(1 / ASSETS.length);
}

export type CloudPoint = { vol: number; ret: number };

function dirichlet(rand: () => number, n: number): number[] {
  const x = Array.from({ length: n }, () => -Math.log(Math.max(rand(), 1e-12)));
  const s = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / s);
}

export function randomCloud(mu: number[] = PANEL.mu, count = 240): CloudPoint[] {
  const rand = mulberry32(99);
  const out: CloudPoint[] = [];
  for (let i = 0; i < count; i++) {
    const w = dirichlet(rand, ASSETS.length);
    const s = portStats(w, mu);
    out.push({ vol: s.vol, ret: s.ret });
  }
  return out;
}

export function correlation(): number[][] {
  const n = ASSETS.length;
  const c = Array.from({ length: n }, () => Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const d = PANEL.vols[i]! * PANEL.vols[j]!;
      c[i]![j] = d === 0 ? 0 : PANEL.cov[i]![j]! / d;
    }
  }
  return c;
}

export const CORR: number[][] = correlation();

/** Wealth of ₹1, monthly compounded. */
export function wealthPath(weights: number[]): { month: number; wealth: number }[] {
  const out: { month: number; wealth: number }[] = [{ month: 0, wealth: 1 }];
  let w = 1;
  for (let t = 0; t < PANEL.returns.length; t++) {
    const r = dot(weights, PANEL.returns[t]!);
    w *= 1 + r;
    out.push({ month: t + 1, wealth: w });
  }
  return out;
}

export function assetSharpe(i: number): number {
  const excess = PANEL.annReturn[i]! - RF_ANNUAL;
  const vol = PANEL.annVol[i]!;
  return vol === 0 ? 0 : excess / vol;
}
