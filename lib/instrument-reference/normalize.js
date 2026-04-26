export class NormalizationError extends Error {}

const VALID_NORMALIZED = /^[A-Z0-9.\-]+$/

export function normalizeTicker(raw) {
  if (typeof raw !== 'string') {
    throw new NormalizationError(`input must be string, got ${typeof raw}`)
  }

  let t = raw.trim().toUpperCase()

  const slashIdx = t.indexOf('/')
  if (slashIdx !== -1) t = t.slice(0, slashIdx)

  if (!t) throw new NormalizationError(`normalization produced empty string from: "${raw}"`)
  if (!VALID_NORMALIZED.test(t)) {
    throw new NormalizationError(`invalid characters after normalization: "${t}" (from: "${raw}")`)
  }

  return t
}
