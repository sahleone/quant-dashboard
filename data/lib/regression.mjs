/**
 * Small-sample OLS: y ~ 1 + f1 + f2 + ... (same length vectors).
 * Returns coefficient vector matching [intercept, ...factorSlopes].
 */
export function olsMultivariate(y, factorCols) {
  const n = y.length
  const k = factorCols.length
  if (n < k + 2 || factorCols.some((col) => col.length !== n)) return null

  const p = k + 1
  const XtX = Array.from({ length: p }, () => Array(p).fill(0))
  const Xty = Array(p).fill(0)

  for (let i = 0; i < n; i++) {
    const xi = [1, ...factorCols.map((col) => col[i])]
    const yi = y[i]
    for (let a = 0; a < p; a++) {
      Xty[a] += xi[a] * yi
      for (let b = 0; b < p; b++) {
        XtX[a][b] += xi[a] * xi[b]
      }
    }
  }

  const coef = solveSymmetric(XtX, Xty)
  if (!coef) return null

  let ssTot = 0
  const yMean = y.reduce((s, v) => s + v, 0) / n
  for (let i = 0; i < n; i++) ssTot += (y[i] - yMean) ** 2

  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const xi = [1, ...factorCols.map((col) => col[i])]
    let pred = 0
    for (let j = 0; j < p; j++) pred += coef[j] * xi[j]
    ssRes += (y[i] - pred) ** 2
  }

  const r2 = ssTot > 1e-30 ? 1 - ssRes / ssTot : null

  return { coefficients: coef, r2, nObs: n }
}

function solveSymmetric(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    let piv = col
    let best = Math.abs(M[col][col])
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col])
      if (v > best) {
        best = v
        piv = r
      }
    }
    if (best < 1e-18) return null
    if (piv !== col) {
      const tmp = M[col]
      M[col] = M[piv]
      M[piv] = tmp
    }

    const diag = M[col][col]
    for (let j = col; j <= n; j++) M[col][j] /= diag

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (Math.abs(f) < 1e-20) continue
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j]
    }
  }

  return M.map((row) => row[n])
}
