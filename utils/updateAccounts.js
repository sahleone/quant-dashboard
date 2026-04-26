import AccountModel from '@/models/AccountsList'
import { listAccounts } from '@/services/accountClient'

export default async function updateAccountsForUser(userId, userSecret) {
  if (!userId) throw new Error('Missing userId')
  if (!userSecret) throw new Error('Missing userSecret')

  let accounts = []
  try {
    accounts = await listAccounts(userId, userSecret)
  } catch (err) {
    console.error(`Failed to list accounts for user ${userId}:`, err?.message || err)
    throw err
  }

  if (!Array.isArray(accounts) || accounts.length === 0) return []

  const results = []

  for (const rawAccount of accounts) {
    try {
      if (!rawAccount || !rawAccount.id) continue

      const mapped = {
        userId,
        brokerageAuthorizationId:
          rawAccount.authorizationId ||
          rawAccount.authorization_id ||
          rawAccount.brokerage?.id ||
          null,
        accountId: rawAccount.id,
        accountName: rawAccount.name || rawAccount.accountName || 'Unknown',
        number: rawAccount.number || rawAccount.account_number || null,
        currency: rawAccount.currency?.code || rawAccount.currency || 'USD',
        institutionName: rawAccount.institution_name || rawAccount.brokerage?.name || 'Unknown',
        createdDate: rawAccount.created_at
          ? new Date(rawAccount.created_at)
          : rawAccount.createdDate
          ? new Date(rawAccount.createdDate)
          : null,
        raw_type: rawAccount.type || rawAccount.account_type || null,
        status: rawAccount.status || rawAccount.state || null,
      }

      const updated = await AccountModel.findOneAndUpdate(
        { accountId: mapped.accountId },
        { $set: mapped },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )

      if (updated) results.push(updated)
    } catch (err) {
      console.error(`Error upserting account for user ${userId}:`, err?.message || err)
    }
  }

  return results
}

