function toUtcDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }
  return d
}

function dayDiff(startDateKey, endDateKey) {
  const start = toUtcDate(startDateKey)
  const end = toUtcDate(endDateKey)
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

export function groupMissingEventsByRange(events = []) {
  if (!Array.isArray(events) || events.length === 0) return []

  const grouped = new Map()

  for (const event of events) {
    const key = [
      event.accountId ?? '',
      event.symbol ?? '',
      event.status ?? 'unknown',
      event.reason ?? '',
    ].join('|')
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(event)
  }

  const ranges = []
  for (const [, bucket] of grouped.entries()) {
    const sorted = bucket.slice().sort((a, b) => a.date.localeCompare(b.date))
    let current = null

    for (const event of sorted) {
      if (!current) {
        current = {
          accountId: event.accountId,
          symbol: event.symbol,
          status: event.status ?? 'unknown',
          reason: event.reason ?? null,
          startDate: event.date,
          endDate: event.date,
          sampleReason: event.reason ?? null,
        }
        continue
      }

      const gapDays = dayDiff(current.endDate, event.date)
      if (gapDays === 1) {
        current.endDate = event.date
        continue
      }

      current.dayCount = dayDiff(current.startDate, current.endDate) + 1
      ranges.push(current)
      current = {
        accountId: event.accountId,
        symbol: event.symbol,
        status: event.status ?? 'unknown',
        reason: event.reason ?? null,
        startDate: event.date,
        endDate: event.date,
        sampleReason: event.reason ?? null,
      }
    }

    if (current) {
      current.dayCount = dayDiff(current.startDate, current.endDate) + 1
      ranges.push(current)
    }
  }

  return ranges.sort((a, b) => {
    if (a.accountId !== b.accountId) return a.accountId.localeCompare(b.accountId)
    if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol)
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate)
    return a.endDate.localeCompare(b.endDate)
  })
}
