import mongoose from 'mongoose'

export function nextTradingDay(date) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)

  const dow = next.getUTCDay()
  if (dow === 6) next.setUTCDate(next.getUTCDate() + 2)
  else if (dow === 0) next.setUTCDate(next.getUTCDate() + 1)
  return next
}

export async function getCoverage(symbol, requiredStart, requiredEnd, opts = {}) {
  const { forceRefresh = false } = opts

  const db = mongoose.connection.db
  const col = db.collection('pricehistories')

  const agg = await col
    .aggregate([
      { $match: { symbol } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const existingCount = agg.length > 0 ? agg[0].count : 0
  const minDate = agg.length > 0 ? agg[0].minDate : null
  const maxDate = agg.length > 0 ? agg[0].maxDate : null

  if (forceRefresh) {
    return {
      symbol,
      existingCount,
      minDate,
      maxDate,
      needsRestTopUp: true,
      restFrom: requiredStart,
      restTo: requiredEnd,
      reason: 'forceRefresh',
    }
  }

  if (existingCount === 0) {
    return {
      symbol,
      existingCount: 0,
      minDate: null,
      maxDate: null,
      needsRestTopUp: true,
      restFrom: requiredStart,
      restTo: requiredEnd,
      reason: 'no_data',
    }
  }

  const hasLeadingGap = requiredStart < minDate
  const hasTrailingGap = maxDate < requiredEnd

  if (hasLeadingGap) {
    return {
      symbol,
      existingCount,
      minDate,
      maxDate,
      needsRestTopUp: true,
      restFrom: requiredStart,
      restTo: requiredEnd,
      reason: 'leading_gap',
    }
  }

  if (hasTrailingGap) {
    return {
      symbol,
      existingCount,
      minDate,
      maxDate,
      needsRestTopUp: true,
      restFrom: nextTradingDay(maxDate),
      restTo: requiredEnd,
      reason: 'trailing_gap',
    }
  }

  return {
    symbol,
    existingCount,
    minDate,
    maxDate,
    needsRestTopUp: false,
    restFrom: null,
    restTo: null,
    reason: 'complete',
  }
}
