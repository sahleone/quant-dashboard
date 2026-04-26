import Account from '@/models/AccountsList'
import AccountDetail from '@/models/AccountDetail'
import AccountHoldings from '@/models/AccountHoldings'
import AccountBalances from '@/models/AccountBalances'
import AccountPositions from '@/models/AccountPositions'
import AccountOrders from '@/models/AccountOrders'
import Activities from '@/models/AccountActivities'
import User from '@/models/Users'
import ConnectionModel from '@/models/Connection'
import { syncAllAccountData } from '@/services/accountClient'
import { upsertWithDuplicateCheck, UNIQUE_FIELD_MAPPINGS } from '@/utils/duplicateHandler'

export default async function updateAccountHoldingsForUser(userId, userSecret = null, options = {}) {
  if (!userId) throw new Error('Missing userId')

  let effectiveSecret = userSecret
  let user = null

  if (!effectiveSecret) {
    user = await User.findOne({ userId })
    if (!user || !user.userSecret) {
      throw new Error('Missing userSecret for user')
    }
    effectiveSecret = user.userSecret
  } else {
    user = await User.findOne({ userId }).catch((err) => {
      console.warn(`Non-critical: failed to load user metadata for userId=${userId}:`, err?.message || err)
      return null
    })
  }

  const connectionDocs = await ConnectionModel.find({ userId }).lean()
  const connectionIds = (connectionDocs || []).map((c) => c.connectionId)

  const { listAccounts } = await import('@/services/accountClient')
  let snapAccounts = []
  try {
    snapAccounts = await listAccounts(userId, effectiveSecret)
  } catch (err) {
    console.error('Failed to list accounts from SnapTrade:', err?.message || err)
    throw err
  }

  if (!Array.isArray(snapAccounts) || snapAccounts.length === 0) return []

  const results = []
  const fullSync = !!options.fullSync

  const extractAuthId = (acct) =>
    acct.authorizationId ||
    acct.authorization_id ||
    acct.brokerage_authorization ||
    acct.brokerage_authorization_id ||
    acct.connection_id ||
    acct.connectionId ||
    acct.brokerage?.id ||
    null

  for (const acct of snapAccounts) {
    try {
      const authId = extractAuthId(acct)

      if (connectionIds.length && authId && !connectionIds.includes(authId)) {
        continue
      }

      const accountId = acct.id || acct.accountId || acct.account_id
      if (!accountId) continue

      const syncData = await syncAllAccountData(userId, effectiveSecret, accountId, {
        days: fullSync ? 365 : 30,
      })

      if (syncData.account) {
        await Account.findOneAndUpdate({ accountId }, syncData.account, { upsert: true })
      }

      if (syncData.accountDetail) {
        await AccountDetail.findOneAndUpdate({ accountId }, syncData.accountDetail, { upsert: true })
      }

      if (syncData.balances) {
        await AccountBalances.findOneAndUpdate(
          { accountId, asOfDate: syncData.balances.asOfDate },
          syncData.balances,
          { upsert: true }
        )
      }

      let holdingsResult = null
      let positionsResult = null
      let ordersResult = null

      if (Array.isArray(syncData.holdings) && syncData.holdings.length) {
        holdingsResult = await upsertWithDuplicateCheck(
          AccountHoldings,
          syncData.holdings,
          UNIQUE_FIELD_MAPPINGS.AccountHoldings,
          'holdings'
        )
      }

      if (Array.isArray(syncData.positions) && syncData.positions.length) {
        positionsResult = await upsertWithDuplicateCheck(
          AccountPositions,
          syncData.positions,
          UNIQUE_FIELD_MAPPINGS.AccountPositions,
          'positions'
        )
      }

      if (Array.isArray(syncData.orders) && syncData.orders.length) {
        ordersResult = await upsertWithDuplicateCheck(
          AccountOrders,
          syncData.orders,
          UNIQUE_FIELD_MAPPINGS.AccountOrders,
          'orders'
        )
      }

      let activitiesResult = null
      if (Array.isArray(syncData.activities) && syncData.activities.length) {
        activitiesResult = await upsertWithDuplicateCheck(
          Activities,
          syncData.activities,
          UNIQUE_FIELD_MAPPINGS.Activities,
          'activities'
        )
        console.log(`Activities sync result for account ${accountId}:`, activitiesResult)
      }

      results.push({
        accountId,
        status: 'success',
        holdings: holdingsResult || null,
        positions: positionsResult || null,
        orders: ordersResult || null,
        activities: activitiesResult || null,
      })
    } catch (err) {
      console.error(`Failed to sync account ${acct.id || acct.accountId}:`, err?.message || err)
      results.push({
        accountId: acct.id || acct.accountId || null,
        status: 'failed',
        error: err?.message || String(err),
      })
    }
  }

  return results
}

