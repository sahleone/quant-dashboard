export function aggregateTimeseriesByDate(records) {
  const byDate = new Map()
  const hasAccountDimension = records.some((record) => record?.accountId != null)

  for (const record of records) {
    const d = record.date ? new Date(record.date) : null
    if (!d || Number.isNaN(d.getTime())) continue
    const dateKey = d.toISOString().split('T')[0]
    let bucket = byDate.get(dateKey)
    if (!bucket) {
      bucket = {
        date: new Date(`${dateKey}T00:00:00.000Z`),
        totalValue: 0,
        stockValue: 0,
        cashValue: 0,
        _accounts: new Set(),
      }
      byDate.set(dateKey, bucket)
    }
    bucket.totalValue += Number(record.totalValue) || 0
    bucket.stockValue += Number(record.stockValue) || 0
    bucket.cashValue += Number(record.cashValue) || 0
    if (record.accountId != null) bucket._accounts.add(String(record.accountId))
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      date: v.date,
      totalValue: v.totalValue,
      stockValue: v.stockValue,
      cashValue: v.cashValue,
      _accountCount: v._accounts.size,
    }))

  if (!hasAccountDimension || points.length === 0) {
    return points.map(({ _accountCount, ...rest }) => rest)
  }

  const recentWindow = points.slice(-30)
  const expectedAccountCount = recentWindow.reduce(
    (max, point) => Math.max(max, point._accountCount),
    0
  )

  while (
    points.length > 1 &&
    expectedAccountCount > 0 &&
    points[points.length - 1]._accountCount < expectedAccountCount
  ) {
    points.pop()
  }

  return points.map(({ _accountCount, ...rest }) => rest)
}
