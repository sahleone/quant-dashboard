export function calculateAUM(portfolioTimeseries) {
  if (!portfolioTimeseries || portfolioTimeseries.length === 0) return 0
  return portfolioTimeseries[portfolioTimeseries.length - 1].totalValue || 0
}

export function calculateAssetAllocation(positions, totalValue) {
  if (!positions || positions.length === 0 || totalValue <= 0) return {}
  const allocation = {}
  for (const pos of positions) {
    const weight = (pos.value || 0) / totalValue
    if (weight > 0) allocation[pos.symbol] = weight
  }
  return allocation
}

export function calculateHHI(weights) {
  if (!weights || Object.keys(weights).length === 0) return 0
  let hhi = 0
  for (const weight of Object.values(weights)) hhi += weight * weight
  return hhi
}

export function calculateDiversificationScore(hhi) {
  return 1 - hhi
}

export function calculateDividendIncome(activities, startDate, endDate) {
  if (!activities || activities.length === 0) return 0
  let total = 0
  for (const activity of activities) {
    const type = String(activity.type || '').toUpperCase()
    if (type === 'DIVIDEND' || type === 'STOCK_DIVIDEND') {
      const date = new Date(activity.trade_date || activity.date)
      if (date >= startDate && date <= endDate) {
        const amount = parseFloat(activity.amount || 0)
        if (!isNaN(amount) && amount > 0) total += amount
      }
    }
  }
  return total
}

export function calculateInterestIncome(activities, startDate, endDate) {
  if (!activities || activities.length === 0) return 0
  let total = 0
  for (const activity of activities) {
    const type = String(activity.type || '').toUpperCase()
    if (type === 'INTEREST') {
      const date = new Date(activity.trade_date || activity.date)
      if (date >= startDate && date <= endDate) {
        const amount = parseFloat(activity.amount || 0)
        if (!isNaN(amount) && amount > 0) total += amount
      }
    }
  }
  return total
}

export function calculateTotalIncomeYield(dividendIncome, interestIncome, avgPortfolioValue) {
  if (!avgPortfolioValue || avgPortfolioValue <= 0) return 0
  return (dividendIncome + interestIncome) / avgPortfolioValue
}
