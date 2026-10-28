import { describe, expect, it } from "vitest";
import {
  ASSETS,
  CORR,
  PANEL,
  RF_ANNUAL,
  assetSharpe,
  buildPanel,
  equalWeight,
  frontier,
  maxSharpe,
  optimize,
  portStats,
  randomCloud,
  shrinkMeans,
  wealthPath,
} from "./markets";
import { dot, matVec } from "./stats";

const n = ASSETS.length;

describe("simulated panel", () => {
  it("has sixty months of ten names and four factors", () => {
    expect(PANEL.returns).toHaveLength(60);
    expect(PANEL.returns[0]).toHaveLength(n);
    expect(PANEL.factors).toHaveLength(60);
    expect(PANEL.factors[0]).toHaveLength(4);
    expect(PANEL.regs).toHaveLength(n);
  });

  it("is reproducible from its seed", () => {
    const again = buildPanel(2048);
    expect(again.returns[7]).toEqual(PANEL.returns[7]);
    expect(again.mu).toEqual(PANEL.mu);
  });

  it("annualises means by twelve and vols by root twelve", () => {
    for (let i = 0; i < n; i++) {
      const col = PANEL.returns.map((row) => row[i] ?? 0);
      const mean = col.reduce((s, x) => s + x, 0) / col.length;
      expect(PANEL.annReturn[i]).toBeCloseTo(mean * 12, 12);
      expect(PANEL.annVol[i]).toBeCloseTo(Math.sqrt(PANEL.cov[i]?.[i] ?? 0), 10);
    }
  });

  it("covariance is symmetric and correlation is unit on the diagonal", () => {
    for (let i = 0; i < n; i++) {
      expect(CORR[i]?.[i]).toBeCloseTo(1, 10);
      for (let j = 0; j < n; j++) {
        expect(PANEL.cov[i]?.[j]).toBeCloseTo(PANEL.cov[j]?.[i] ?? Number.NaN, 12);
        expect(Math.abs(CORR[i]?.[j] ?? 2)).toBeLessThanOrEqual(1 + 1e-12);
      }
    }
  });
});

describe("factor regression", () => {
  it("recovers every market beta to within sampling error", () => {
    let totalError = 0;
    ASSETS.forEach((asset, i) => {
      const est = PANEL.regs[i]?.beta[1] ?? Number.NaN;
      const err = Math.abs(est - asset.beta[0]);
      expect(err).toBeLessThan(0.35);
      totalError += err;
    });
    expect(totalError / n).toBeLessThan(0.15);
  });

  it("finds the market factor significant for every name", () => {
    for (const reg of PANEL.regs) expect(reg.t[1] ?? 0).toBeGreaterThan(3);
  });

  it("reports R² between zero and one with five estimated coefficients", () => {
    for (const reg of PANEL.regs) {
      expect(reg.k).toBe(5);
      expect(reg.n).toBe(60);
      expect(reg.r2).toBeGreaterThan(0);
      expect(reg.r2).toBeLessThanOrEqual(1);
    }
  });
});

describe("portfolio arithmetic", () => {
  it("portStats computes return, vol and Sharpe from the inputs", () => {
    const w = equalWeight();
    const s = portStats(w);
    expect(s.ret).toBeCloseTo(dot(w, PANEL.mu), 12);
    expect(s.vol).toBeCloseTo(Math.sqrt(dot(w, matVec(PANEL.cov, w))), 12);
    expect(s.sharpe).toBeCloseTo((s.ret - RF_ANNUAL) / s.vol, 12);
  });

  it("equal weight sums to one", () => {
    expect(equalWeight().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("assetSharpe uses the same risk-free rate", () => {
    expect(assetSharpe(0)).toBeCloseTo(
      ((PANEL.annReturn[0] ?? 0) - RF_ANNUAL) / (PANEL.annVol[0] ?? 1),
      12,
    );
  });

  it("wealth path starts at one rupee and compounds monthly", () => {
    const path = wealthPath(equalWeight());
    expect(path).toHaveLength(61);
    expect(path[0]).toEqual({ month: 0, wealth: 1 });
    const firstReturn = dot(equalWeight(), PANEL.returns[0] ?? []);
    expect(path[1]?.wealth).toBeCloseTo(1 + firstReturn, 12);
  });
});

describe("shrinkage", () => {
  it("does nothing at zero and collapses to the grand mean at one", () => {
    expect(shrinkMeans(0)).toEqual(PANEL.mu);
    const grand = PANEL.mu.reduce((s, m) => s + m, 0) / n;
    for (const m of shrinkMeans(1)) expect(m).toBeCloseTo(grand, 12);
  });

  it("is clamped to [0, 1]", () => {
    expect(shrinkMeans(5)).toEqual(shrinkMeans(1));
    expect(shrinkMeans(-1)).toEqual(shrinkMeans(0));
  });
});

describe("optimizer", () => {
  it("returns feasible long-only capped weights", () => {
    for (const cap of [0.2, 0.3, 0.4, 1]) {
      const w = optimize(3, cap);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
      for (const wi of w) {
        expect(wi).toBeGreaterThanOrEqual(-1e-12);
        expect(wi).toBeLessThanOrEqual(cap + 1e-8);
      }
    }
  });

  it("never does worse than its equal-weight starting point", () => {
    for (const lambda of [0.6, 3, 20]) {
      const w = optimize(lambda, 0.3);
      const ew = equalWeight();
      const u = (x: number[]) => dot(x, PANEL.mu) - 0.5 * lambda * dot(x, matVec(PANEL.cov, x));
      expect(u(w)).toBeGreaterThanOrEqual(u(ew) - 1e-12);
    }
  });

  it("takes less risk as risk aversion rises", () => {
    const brave = portStats(optimize(0.6, 0.3));
    const timid = portStats(optimize(50, 0.3));
    expect(timid.vol).toBeLessThan(brave.vol);
  });

  it("frontier points are feasible and the max-Sharpe point is one of them", () => {
    const points = frontier(0.3);
    expect(points).toHaveLength(12);
    const best = maxSharpe(0.3);
    expect(points.some((p) => p.lambda === best.lambda)).toBe(true);
    for (const p of points) expect(p.sharpe).toBeLessThanOrEqual(best.sharpe + 1e-12);
  });

  it("beats equal weight in sample, which is the point being made", () => {
    const mu = shrinkMeans(0.25);
    const best = maxSharpe(0.3, mu);
    expect(best.sharpe).toBeGreaterThan(portStats(equalWeight(), mu).sharpe);
  });
});

describe("random cloud", () => {
  it("draws the requested number of feasible books", () => {
    const cloud = randomCloud(PANEL.mu, 50);
    expect(cloud).toHaveLength(50);
    for (const p of cloud) {
      expect(p.vol).toBeGreaterThan(0);
      expect(Number.isFinite(p.ret)).toBe(true);
    }
  });
});
