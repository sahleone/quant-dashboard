import { updatePriceData } from '@/lib/metrics/updateTable/updatePriceData'
import { updatePortfolioTimeseries } from '@/lib/metrics/updateTable/updatePortfolioTimeseries'
import { calculateMetrics } from '@/lib/metrics/calculateMetrics'
import { validateMetrics } from '@/lib/metrics/validateMetrics'

export async function runMetricsPipeline(opts = {}) {
  const {
    userId,
    accountId,
    fullSync = false,
    steps = ['price', 'valuation', 'returns', 'metrics', 'validate'],
    dryRun = false,
  } = opts

  const commonOpts = { userId, accountId, fullSync }

  console.log('=== Metrics Pipeline ===')
  console.log(`Mode: ${fullSync ? 'Full Sync' : 'Incremental'}`)
  console.log(`Steps: ${steps.join(', ')}`)

  const results = { price: null, valuation: null, returns: null, metrics: null, validate: null, errors: [] }

  let priceStepOk = true
  let valuationStepOk = true

  if (steps.includes('price')) {
    try {
      console.log('Step 1: Price Data and Corporate Actions...')
      if (!dryRun) {
        results.price = await updatePriceData(commonOpts)
        if (results.price?.errors?.length > 0) console.warn(`  Price data completed with ${results.price.errors.length} error(s)`)
        console.log('  Price data completed')
      } else {
        console.log('  [DRY RUN] Would run updatePriceData')
      }
    } catch (error) {
      console.error('  Price data failed:', error?.message || error)
      results.errors.push({ step: 'price', error: error?.message || String(error) })
      priceStepOk = false
    }
  }

  if (steps.includes('valuation') || steps.includes('returns')) {
    if (!priceStepOk && steps.includes('price')) {
      console.error('  Skipping portfolio valuation — price data step failed')
      results.errors.push({ step: 'valuation', error: 'Skipped: price data step failed' })
      valuationStepOk = false
    } else {
      try {
        console.log('Step 2-3: Portfolio Valuation and Returns...')
        if (!dryRun) {
          results.valuation = await updatePortfolioTimeseries(commonOpts)
          results.returns = results.valuation
          console.log('  Portfolio valuation and returns completed')
        } else {
          console.log('  [DRY RUN] Would run updatePortfolioTimeseries')
        }
      } catch (error) {
        console.error('  Portfolio valuation failed:', error?.message || error)
        results.errors.push({ step: 'valuation', error: error?.message || String(error) })
        valuationStepOk = false
      }
    }
  }

  if (steps.includes('metrics')) {
    if (!valuationStepOk && (steps.includes('valuation') || steps.includes('returns'))) {
      console.error('  Skipping metrics calculation — portfolio valuation step failed')
      results.errors.push({ step: 'metrics', error: 'Skipped: portfolio valuation step failed' })
    } else {
      try {
        console.log('Step 4: Metrics Calculation...')
        if (!dryRun) {
          results.metrics = await calculateMetrics(commonOpts)
          console.log('  Metrics calculation completed')
        } else {
          console.log('  [DRY RUN] Would run calculateMetrics')
        }
      } catch (error) {
        console.error('  Metrics calculation failed:', error?.message || error)
        results.errors.push({ step: 'metrics', error: error?.message || String(error) })
      }
    }
  }

  if (steps.includes('validate')) {
    try {
      console.log('Step 5: Validation...')
      if (!dryRun) {
        results.validate = await validateMetrics({ ...commonOpts, sendAlerts: false })
        console.log('  Validation completed')
      } else {
        console.log('  [DRY RUN] Would run validateMetrics')
      }
    } catch (error) {
      console.error('  Validation failed:', error?.message || error)
      results.errors.push({ step: 'validate', error: error?.message || String(error) })
    }
  }

  console.log(`\n=== Pipeline Summary === Errors: ${results.errors.length}`)

  return results
}
