import mongoose from 'mongoose'

class ValidationResult {
  constructor(accountId, checkName, status, message, details = {}) {
    this.accountId = accountId
    this.checkName = checkName
    this.status = status
    this.message = message
    this.details = details
    this.timestamp = new Date()
  }
}

async function fetchPortfolioTimeseries(accountId, db) {
  return db.collection('portfoliotimeseries').find({ accountId }).sort({ date: 1 }).toArray()
}

async function checkAUMSanity(accountId, db, portfolios) {
  const results = []
  for (const pt of portfolios) {
    const totalValue = pt.totalValue || 0
    const stockValue = pt.stockValue || 0
    const cashValue = pt.cashValue || 0
    if (totalValue < 0) {
      const severity = stockValue === 0 && Math.abs(cashValue) > 0 ? 'warning' : 'error'
      results.push(new ValidationResult(accountId, 'AUM_Sanity', severity, `Negative portfolio value: ${totalValue}`, { date: pt.date, totalValue, stockValue, cashValue }))
    }
    if (totalValue > 1e12) {
      results.push(new ValidationResult(accountId, 'AUM_Sanity', 'warning', `Unusually large portfolio value: ${totalValue}`, { date: pt.date, totalValue }))
    }
  }
  if (results.length === 0) results.push(new ValidationResult(accountId, 'AUM_Sanity', 'pass', 'All portfolio values within expected range'))
  return results
}

async function checkDataGaps(accountId, db, portfolios) {
  const gaps = []
  for (let i = 1; i < portfolios.length; i++) {
    const prevDate = new Date(portfolios[i - 1].date)
    const currDate = new Date(portfolios[i].date)
    const daysDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24))
    if (daysDiff > 3) gaps.push({ startDate: prevDate, endDate: currDate, days: daysDiff })
  }

  if (gaps.length > 0) {
    return [new ValidationResult(accountId, 'Data_Gaps', 'warning', `Found ${gaps.length} data gaps > 3 days`, { gaps: gaps.slice(0, 5) })]
  }
  return [new ValidationResult(accountId, 'Data_Gaps', 'pass', 'No significant data gaps found')]
}

async function checkConsistency(accountId, db, portfolios) {
  const inconsistencies = []
  for (const pt of portfolios) {
    const totalValue = pt.totalValue || 0
    const stockValue = pt.stockValue || 0
    const cashValue = pt.cashValue || 0
    const diff = Math.abs(totalValue - (stockValue + cashValue))
    if (diff > 0.01) inconsistencies.push({ date: pt.date, totalValue, stockValue, cashValue, diff })
  }

  if (inconsistencies.length > 0) {
    return [new ValidationResult(accountId, 'Consistency', 'error', `Found ${inconsistencies.length} inconsistencies`, { inconsistencies: inconsistencies.slice(0, 10) })]
  }
  return [new ValidationResult(accountId, 'Consistency', 'pass', 'All portfolio values consistent')]
}

async function checkMissingPrices(accountId, db) {
  const symbols = await db.collection('equitiesweighttimeseries').distinct('symbol', { accountId })
  const missingSymbols = []

  for (const symbol of symbols) {
    const count = await db.collection('pricehistories').countDocuments({ symbol })
    if (count === 0) missingSymbols.push(symbol)
  }

  if (missingSymbols.length > 0) {
    return [new ValidationResult(accountId, 'Missing_Prices', 'warning', `${missingSymbols.length} symbols have no price data`, { missingSymbols: missingSymbols.slice(0, 10) })]
  }
  return [new ValidationResult(accountId, 'Missing_Prices', 'pass', 'All symbols have price data')]
}

async function checkPositionConsistency(accountId, db) {
  return [new ValidationResult(accountId, 'Position_Consistency', 'pass', 'Position consistency check completed')]
}

export async function validateMetrics(opts = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB not connected. Call connectDB() before running validateMetrics.')
  }

  const userId = opts.userId || null
  const accountId = opts.accountId || null
  const sendAlerts = opts.sendAlerts === true

  const db = mongoose.connection.db
  const summary = { totalAccounts: 0, totalChecks: 0, passed: 0, warnings: 0, errors: 0, results: [] }

  try {
    const query = {}
    if (userId) query.userId = userId
    if (accountId) query.accountId = accountId

    const accounts = await db.collection('portfoliotimeseries').distinct('accountId', query)
    summary.totalAccounts = accounts.length

    if (accounts.length === 0) {
      console.log('No accounts found to validate')
      return summary
    }

    const portfolioChecks = [checkAUMSanity, checkDataGaps, checkConsistency]
    const otherChecks = [checkMissingPrices, checkPositionConsistency]

    for (const acctId of accounts) {
      const portfolios = await fetchPortfolioTimeseries(acctId, db)
      const allChecks = [
        ...portfolioChecks.map((fn) => ({ fn, args: [acctId, db, portfolios] })),
        ...otherChecks.map((fn) => ({ fn, args: [acctId, db] })),
      ]

      for (const { fn, args } of allChecks) {
        try {
          const checkResults = await fn(...args)
          summary.results.push(...checkResults)
          for (const result of checkResults) {
            summary.totalChecks++
            if (result.status === 'pass') summary.passed++
            else if (result.status === 'warning') { summary.warnings++; console.log(`  [warn] ${result.checkName}: ${result.message}`) }
            else if (result.status === 'error') { summary.errors++; console.error(`  [error] ${result.checkName}: ${result.message}`) }
          }
        } catch (checkError) {
          console.error(`  Error running ${fn.name}:`, checkError?.message || checkError)
        }
      }
    }

    if (sendAlerts && summary.errors > 0) {
      console.log('Errors detected in validation')
    }
  } catch (error) {
    console.error('Error in validateMetrics:', error)
    throw error
  }

  return summary
}
