/**
 * Phase 4 — 개인화 Ridge MVP: 순수 TS Ridge (정규방정식)
 * β = (XᵀX + λI)⁻¹ Xᵀy  (intercept 별도: 특징 평균 중심화)
 */

export type RidgeFit = {
  intercept: number;
  coefficients: number[];
  lambda: number;
  featureMeans: number[];
  featureStds: number[];
};

const EPS = 1e-12;

export function meanStd(col: number[]): { mean: number; std: number } {
  const n = col.length;
  if (n === 0) return { mean: 0, std: 1 };
  const mean = col.reduce((a, b) => a + b, 0) / n;
  let v = 0;
  for (const x of col) {
    const d = x - mean;
    v += d * d;
  }
  const std = Math.sqrt(v / Math.max(n - 1, 1));
  return { mean, std: std < EPS ? 1 : std };
}

/** 열 표준화 */
export function standardizeMatrix(X: number[][]): {
  Xs: number[][];
  means: number[];
  stds: number[];
} {
  if (X.length === 0) return { Xs: [], means: [], stds: [] };
  const p = X[0]!.length;
  const means: number[] = [];
  const stds: number[] = [];
  for (let j = 0; j < p; j++) {
    const col = X.map((r) => r[j]!);
    const { mean, std } = meanStd(col);
    means.push(mean);
    stds.push(std);
  }
  const Xs = X.map((row) =>
    row.map((v, j) => (v - means[j]!) / stds[j]!)
  );
  return { Xs, means, stds };
}

function identity(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const m = B[0]!.length;
  const k = B.length;
  const C = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i]![t]!;
      for (let j = 0; j < m; j++) {
        C[i]![j]! += a * B[t]![j]!;
      }
    }
  }
  return C;
}

function transpose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  const n = A.length;
  const m = A[0]!.length;
  const T = Array.from({ length: m }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      T[j]![i]! = A[i]![j]!;
    }
  }
  return T;
}

/** Gauss-Jordan inverse; singular → null */
export function invertMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...identity(n)[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(M[pivot]![col]!) < EPS) return null;
    if (pivot !== col) {
      const tmp = M[col]!;
      M[col] = M[pivot]!;
      M[pivot] = tmp;
    }
    const div = M[col]![col]!;
    for (let j = 0; j < 2 * n; j++) M[col]![j]! /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]!;
      for (let j = 0; j < 2 * n; j++) M[r]![j]! -= f * M[col]![j]!;
    }
  }
  return M.map((row) => row.slice(n));
}

export function fitRidge(
  X: number[][],
  y: number[],
  lambda: number
): RidgeFit | { error: string } {
  if (X.length === 0 || X.length !== y.length) {
    return { error: "empty_or_mismatch" };
  }
  if (!Number.isFinite(lambda) || lambda < 0) {
    return { error: "bad_lambda" };
  }
  const p = X[0]!.length;
  if (p === 0) return { error: "no_features" };
  if (p >= X.length) {
    // still allow with strong ridge but flag
  }

  for (const row of X) {
    for (const v of row) {
      if (!Number.isFinite(v)) return { error: "non_finite_feature" };
    }
  }
  for (const v of y) {
    if (!Number.isFinite(v)) return { error: "non_finite_target" };
  }

  const { Xs, means, stds } = standardizeMatrix(X);
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const yc = y.map((v) => v - yMean);

  const Xt = transpose(Xs);
  const XtX = matMul(Xt, Xs);
  for (let i = 0; i < p; i++) {
    XtX[i]![i]! += lambda;
  }
  const inv = invertMatrix(XtX);
  if (!inv) return { error: "singular" };

  const Xty = Xt.map((row) =>
    row.reduce((s, v, i) => s + v * yc[i]!, 0)
  );
  const coefficients = inv.map((row) =>
    row.reduce((s, v, j) => s + v * Xty[j]!, 0)
  );

  return {
    intercept: yMean,
    coefficients,
    lambda,
    featureMeans: means,
    featureStds: stds,
  };
}

export function predictRidge(fit: RidgeFit, x: number[]): number {
  let s = fit.intercept;
  for (let j = 0; j < fit.coefficients.length; j++) {
    const z = (x[j]! - fit.featureMeans[j]!) / fit.featureStds[j]!;
    s += fit.coefficients[j]! * z;
  }
  return s;
}

export function mae(actual: number[], pred: number[]): number {
  if (actual.length === 0) return Infinity;
  let s = 0;
  for (let i = 0; i < actual.length; i++) {
    s += Math.abs(actual[i]! - pred[i]!);
  }
  return s / actual.length;
}

export function directionAccuracy(
  actual: number[],
  pred: number[],
  baseline = 0
): number | null {
  if (actual.length === 0) return null;
  let ok = 0;
  let n = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i]! - baseline;
    const p = pred[i]! - baseline;
    if (Math.abs(a) < 1e-9 && Math.abs(p) < 1e-9) continue;
    n += 1;
    if (a === 0 || p === 0) continue;
    if (Math.sign(a) === Math.sign(p)) ok += 1;
  }
  if (n === 0) return null;
  return ok / n;
}

/** Spearman rho (평균 rank, 타이 포함) */
export function spearmanRho(a: number[], b: number[]): number | null {
  if (a.length < 3 || a.length !== b.length) return null;
  const rank = (arr: number[]) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
    const r = Array(arr.length).fill(0);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j < idx.length && idx[j]!.v === idx[i]!.v) j++;
      const avg = (i + j - 1) / 2 + 1;
      for (let k = i; k < j; k++) r[idx[k]!.i] = avg;
      i = j;
    }
    return r as number[];
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = ra[i]! - ma;
    const xb = rb[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da < EPS || db < EPS) return null;
  return num / Math.sqrt(da * db);
}

export const DEFAULT_LAMBDA = 10;
export const LAMBDA_CANDIDATES = [1, 3, 10, 30] as const;
