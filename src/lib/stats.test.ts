import { describe, expect, it } from "vitest";
import {
  cholesky,
  erf,
  irr,
  matVec,
  mirr,
  mulberry32,
  normalCdf,
  npv,
  ols,
  payback,
  percentile,
  projectCappedSimplex,
  randn,
  signChanges,
} from "./stats";

describe("random numbers", () => {
  it("mulberry32 is deterministic and uniform on [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 20_000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it("randn has mean zero and unit variance", () => {
    const rand = mulberry32(99);
    const zs = Array.from({ length: 50_000 }, () => randn(rand));
    const mean = zs.reduce((s, z) => s + z, 0) / zs.length;
    const variance = zs.reduce((s, z) => s + (z - mean) ** 2, 0) / (zs.length - 1);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(variance).toBeCloseTo(1, 1);
  });
});

describe("normal distribution", () => {
  it("erf matches tabulated values", () => {
    expect(erf(0)).toBeCloseTo(0, 14);
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 12);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 12);
  });

  it("normalCdf matches double-precision reference values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 14);
    expect(normalCdf(0.5)).toBeCloseTo(0.6914624612740131, 12);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 12);
    expect(normalCdf(2)).toBeCloseTo(0.9772498680518208, 12);
    expect(normalCdf(-3)).toBeCloseTo(0.0013498980316301, 12);
    expect(normalCdf(5)).toBeCloseTo(0.9999997133484281, 12);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 12);
    expect(normalCdf(-8)).toBeCloseTo(6.220960574271784e-16, 20);
    expect(normalCdf(40)).toBe(1);
    expect(normalCdf(-40)).toBe(0);
  });

  it("normalCdf is symmetric", () => {
    for (const x of [0.1, 0.7, 1.3, 2.9, 6, 7.5]) {
      expect(normalCdf(x) + normalCdf(-x)).toBeCloseTo(1, 14);
    }
  });
});

describe("capital budgeting helpers", () => {
  const flows = [-100, 30, 40, 50, 20];

  it("npv discounts from t0", () => {
    expect(npv(0, flows)).toBeCloseTo(40, 10);
    expect(npv(0.1, flows)).toBeCloseTo(-100 + 30 / 1.1 + 40 / 1.21 + 50 / 1.331 + 20 / 1.4641, 8);
  });

  it("irr is the rate that zeroes the npv", () => {
    const r = irr(flows);
    expect(r).not.toBeNull();
    expect(npv(r ?? 0, flows)).toBeCloseTo(0, 8);
  });

  it("irr is null when every flow has the same sign", () => {
    expect(irr([100, 10, 10])).toBeNull();
  });

  it("mirr sits between the finance and reinvestment rates for a normal project", () => {
    const m = mirr(flows, 0.08, 0.12);
    expect(m).not.toBeNull();
    expect(m ?? 0).toBeGreaterThan(0.08);
    // MIRR with a single outlay equals (FV of inflows / outlay)^(1/n) - 1.
    const fv = 30 * 1.12 ** 3 + 40 * 1.12 ** 2 + 50 * 1.12 + 20;
    expect(m ?? 0).toBeCloseTo((fv / 100) ** (1 / 4) - 1, 10);
  });

  it("payback interpolates inside the crossing year", () => {
    // Cumulative: -100, -70, -30, +20 → crosses during year 3, 30/50 of the way.
    expect(payback(flows)).toBeCloseTo(2.6, 10);
    expect(payback([-10, 1, 1])).toBeNull();
  });

  it("signChanges ignores zeros", () => {
    expect(signChanges([-1, 0, 2, 3])).toBe(1);
    expect(signChanges([-1, 2, -3, 4])).toBe(3);
  });
});

describe("percentile", () => {
  it("interpolates linearly on a sorted array", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentile(xs, 0)).toBe(1);
    expect(percentile(xs, 1)).toBe(5);
    expect(percentile(xs, 0.5)).toBe(3);
    expect(percentile(xs, 0.125)).toBeCloseTo(1.5, 10);
  });
});

describe("linear algebra", () => {
  it("cholesky reproduces the matrix", () => {
    const A = [
      [4, 2, 0.6],
      [2, 3, 0.4],
      [0.6, 0.4, 2],
    ];
    const L = cholesky(A);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += (L[i]?.[k] ?? 0) * (L[j]?.[k] ?? 0);
        expect(s).toBeCloseTo(A[i]?.[j] ?? Number.NaN, 10);
      }
    }
  });

  it("matVec multiplies", () => {
    expect(
      matVec(
        [
          [1, 2],
          [3, 4],
        ],
        [1, 1],
      ),
    ).toEqual([3, 7]);
  });

  it("ols recovers a known linear model with an intercept", () => {
    const rand = mulberry32(5);
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 400; i++) {
      const x1 = randn(rand);
      const x2 = randn(rand);
      X.push([1, x1, x2]);
      y.push(2 + 0.5 * x1 - 1.5 * x2 + 0.05 * randn(rand));
    }
    const fit = ols(y, X);
    expect(fit.beta[0]).toBeCloseTo(2, 1);
    expect(fit.beta[1]).toBeCloseTo(0.5, 1);
    expect(fit.beta[2]).toBeCloseTo(-1.5, 1);
    expect(fit.r2).toBeGreaterThan(0.99);
    expect(fit.n).toBe(400);
    expect(fit.k).toBe(3);
    expect(Math.abs(fit.t[1] ?? 0)).toBeGreaterThan(50);
  });

  it("ols refuses an underdetermined system", () => {
    expect(() =>
      ols(
        [1, 2],
        [
          [1, 0],
          [0, 1],
        ],
      ),
    ).toThrow();
  });
});

describe("projectCappedSimplex", () => {
  it("returns weights that sum to one and respect the cap", () => {
    const w = projectCappedSimplex([5, 1, 0.2, -3, 0.1], 0.4);
    const sum = w.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 8);
    for (const wi of w) {
      expect(wi).toBeGreaterThanOrEqual(0);
      expect(wi).toBeLessThanOrEqual(0.4 + 1e-8);
    }
    expect(w[0]).toBeCloseTo(0.4, 6);
    expect(w[1]).toBeCloseTo(0.4, 6);
  });

  it("lifts an infeasible cap to equal weight", () => {
    const w = projectCappedSimplex([3, 2, 1, 0], 0.1);
    for (const wi of w) expect(wi).toBeCloseTo(0.25, 6);
  });
});
