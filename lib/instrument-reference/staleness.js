const STALE_DAYS = 30

export function isStale(doc) {
  if (!doc.lastSuccessAt) return true
  const ageDays = (Date.now() - new Date(doc.lastSuccessAt)) / 86_400_000
  return ageDays > STALE_DAYS
}
