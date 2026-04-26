export function getDateRange(period, asOfDate = new Date()) {
  const endDate = new Date(asOfDate)
  endDate.setHours(23, 59, 59, 999)

  let startDate = null

  switch (period.toUpperCase()) {
    case '1M': {
      startDate = new Date(asOfDate)
      startDate.setMonth(startDate.getMonth() - 1)
      break
    }
    case '3M': {
      startDate = new Date(asOfDate)
      startDate.setMonth(startDate.getMonth() - 3)
      break
    }
    case 'YTD': {
      startDate = new Date(asOfDate.getFullYear(), 0, 1)
      break
    }
    case '1Y': {
      startDate = new Date(asOfDate)
      startDate.setFullYear(startDate.getFullYear() - 1)
      break
    }
    case 'ALL':
    default:
      startDate = null
  }

  if (startDate) startDate.setHours(0, 0, 0, 0)

  return { startDate, endDate }
}
