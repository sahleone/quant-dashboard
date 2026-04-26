export function calculatePointToPointReturn(startValue, endValue) {
  if (!startValue || startValue <= 0) return 0
  return (endValue - startValue) / startValue
}

export function calculateCAGR(startValue, endValue, years) {
  if (!startValue || startValue <= 0 || !years || years <= 0) return 0
  if (endValue <= 0) return -1
  return Math.pow(endValue / startValue, 1 / years) - 1
}

export function calculateCAGRFromReturns(returns, days) {
  if (!returns || returns.length === 0 || !days || days <= 0) return 0
  let product = 1
  for (const ret of returns) product *= 1 + (ret || 0)
  const totalReturn = product - 1
  const years = days / 365.25
  if (years <= 0) return 0
  return Math.pow(1 + totalReturn, 1 / years) - 1
}

export function calculateTWR(portfolioTimeseries, cashFlowDates) {
  if (!portfolioTimeseries || portfolioTimeseries.length === 0) return 0
  if (!cashFlowDates || cashFlowDates.length === 0) {
    const first = portfolioTimeseries[0]
    const last = portfolioTimeseries[portfolioTimeseries.length - 1]
    return calculatePointToPointReturn(first.totalValue || 0, last.totalValue || 0)
  }

  const subperiods = []
  let currentPeriodStart = 0

  for (const cfDate of cashFlowDates) {
    const cfIndex = portfolioTimeseries.findIndex(
      (pt) => new Date(pt.date).toISOString().split('T')[0] === new Date(cfDate).toISOString().split('T')[0]
    )
    if (cfIndex > currentPeriodStart) {
      const periodStart = portfolioTimeseries[currentPeriodStart]
      const periodEnd = portfolioTimeseries[cfIndex - 1]
      subperiods.push(calculatePointToPointReturn(periodStart.totalValue || 0, periodEnd.totalValue || 0))
      currentPeriodStart = cfIndex
    }
  }

  if (currentPeriodStart < portfolioTimeseries.length - 1) {
    const periodStart = portfolioTimeseries[currentPeriodStart]
    const periodEnd = portfolioTimeseries[portfolioTimeseries.length - 1]
    subperiods.push(calculatePointToPointReturn(periodStart.totalValue || 0, periodEnd.totalValue || 0))
  }

  let twr = 1
  for (const p of subperiods) twr *= 1 + p
  return twr - 1
}

export function calculateTWRFromTimeseries(portfolioTimeseries) {
  if (!portfolioTimeseries || portfolioTimeseries.length < 2) return 0

  const subPeriodReturns = []
  let subPeriodStartIdx = 0

  for (let i = 1; i < portfolioTimeseries.length; i++) {
    const hasCashFlow = Math.abs(portfolioTimeseries[i].depositWithdrawal || 0) > 1e-6
    const isLastDay = i === portfolioTimeseries.length - 1

    if (hasCashFlow || isLastDay) {
      const startValue = portfolioTimeseries[subPeriodStartIdx].totalValue || 0
      const endValue = portfolioTimeseries[i].totalValue || 0
      const cashFlow = portfolioTimeseries[i].depositWithdrawal || 0
      const endValueBeforeCashFlow = endValue - cashFlow

      let hp = 0
      if (Math.abs(startValue) > 1e-6) {
        hp = (endValueBeforeCashFlow - startValue) / startValue
      }

      subPeriodReturns.push(hp)
      if (hasCashFlow) subPeriodStartIdx = i
    }
  }

  if (subPeriodReturns.length === 0) {
    const startValue = portfolioTimeseries[0].totalValue || 0
    const endValue = portfolioTimeseries[portfolioTimeseries.length - 1].totalValue || 0
    if (Math.abs(startValue) > 1e-6) return (endValue - startValue) / startValue
    return 0
  }

  const twr = subPeriodReturns.reduce((product, hp) => {
    const factor = 1 + hp
    return product * (isFinite(factor) ? factor : 1)
  }, 1) - 1

  return isFinite(twr) ? twr : 0
}

export function calculateTWRFromDailyReturns(portfolioData, startDate, endDate) {
  if (!portfolioData || portfolioData.length === 0) return null

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  const periodData = portfolioData.filter((pt) => {
    const dateStr = new Date(pt.date).toISOString().split('T')[0]
    return dateStr >= startDateStr && dateStr <= endDateStr
  })

  if (periodData.length === 0) return null

  let sumLogReturns = 0
  let hasValidReturns = false

  for (const dayData of periodData) {
    if (dayData.dailyTWRReturn !== null && dayData.dailyTWRReturn !== undefined && !isNaN(dayData.dailyTWRReturn) && isFinite(dayData.dailyTWRReturn)) {
      sumLogReturns += dayData.dailyTWRReturn
      hasValidReturns = true
    }
  }

  if (!hasValidReturns) return null

  const twr = Math.exp(sumLogReturns) - 1
  return isFinite(twr) ? twr : null
}
