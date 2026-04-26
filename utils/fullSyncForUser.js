import syncAllUserData from '@/utils/syncAllUserData'
import { runMetricsPipeline } from '@/lib/metrics/runMetricsPipeline'
import crypto from 'crypto'

export default async function fullSyncForUser(userId, userSecret = null, options = {}) {
  if (!userId) {
    throw new Error('Missing userId')
  }

  const { fullSync = false, steps, databaseUrl } = options
  const jobId = crypto.randomUUID().slice(0, 8)
  const t0 = Date.now()

  const result = {
    userId,
    jobId,
    sync: null,
    metrics: null,
    errors: [],
    success: false,
  }

  console.log(`[sync] starting full sync for user ${userId} (job ${jobId})`)

  try {
    result.sync = await syncAllUserData(userId, userSecret, { fullSync })
    console.log(`[sync] account data sync complete (job ${jobId})`)
  } catch (err) {
    console.error(`[sync] account data sync failed (job ${jobId}):`, err.message)
    result.errors.push({ step: 'sync', error: err.message })
    result.success = false
    return result
  }

  try {
    const pipelineOpts = {
      userId,
      fullSync,
      ...(databaseUrl && { databaseUrl }),
      ...(steps && { steps }),
    }
    result.metrics = await runMetricsPipeline(pipelineOpts)

    if (result.metrics?.errors?.length > 0) {
      console.warn(`[sync] metrics pipeline had ${result.metrics.errors.length} partial errors (job ${jobId})`)
      result.errors.push(...result.metrics.errors.map((e) => ({ step: 'metrics-sub', ...e })))
    }
  } catch (err) {
    console.error(`[sync] metrics pipeline failed (job ${jobId}):`, err.message)
    result.errors.push({ step: 'metrics', error: err.message })
  }

  result.success = result.errors.length === 0

  const durationMs = Date.now() - t0
  console.log(`[sync] complete (job ${jobId}): success=${result.success}, errors=${result.errors.length}, ${durationMs}ms`)

  return result
}

