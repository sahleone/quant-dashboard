import ConnectionModel from '@/models/Connection'
import User from '@/models/Users'
import { listBrokerageAuthorizations } from '@/services/connectionsClient'

export default async function updateConnectionsForUser(userId, userSecret = null) {
  if (!userId) {
    throw new Error('Missing userId')
  }

  let user = null
  let effectiveSecret = userSecret || null

  if (!effectiveSecret) {
    user = await User.findOne({ userId })
    if (!user) {
      throw new Error(`User not found for userId=${userId}`)
    }
    if (!user.userSecret) {
      throw new Error(`SnapTrade userSecret missing for userId=${userId}`)
    }
    effectiveSecret = user.userSecret
  } else {
    user = await User.findOne({ userId }).catch((err) => {
      console.warn(`Non-critical: failed to load user metadata for userId=${userId}:`, err?.message || err)
      return null
    })
  }

  let connections = []
  try {
    connections = await listBrokerageAuthorizations(userId, effectiveSecret)
  } catch (err) {
    console.error(`Failed to list connections for user ${userId}:`, err?.message || err)
    throw err
  }

  if (!Array.isArray(connections) || connections.length === 0) return []

  const results = []
  const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'ERROR']

  for (const raw of connections) {
    try {
      if (!raw || !raw.id) continue

      const normalizedStatus = (raw.status || 'ACTIVE').toString().toUpperCase()
      const status = ALLOWED_STATUSES.includes(normalizedStatus) ? normalizedStatus : 'ACTIVE'

      const mapped = {
        userId: user?.userId || userId,
        connectionId: raw.id,
        brokerageName: raw.brokerage?.name || raw.brokerage_name || 'Unknown',
        status,
        isActive: status === 'ACTIVE',
        lastSyncDate: raw.last_sync_at
          ? new Date(raw.last_sync_at)
          : raw.lastSyncAt
          ? new Date(raw.lastSyncAt)
          : null,
        createdAt: raw.created_at
          ? new Date(raw.created_at)
          : raw.createdAt
          ? new Date(raw.createdAt)
          : new Date(),
        updatedAt: raw.updated_at
          ? new Date(raw.updated_at)
          : raw.updatedAt
          ? new Date(raw.updatedAt)
          : new Date(),
        metadata: { raw },
      }

      const setPayload = { ...mapped }
      delete setPayload.createdAt

      const updated = await ConnectionModel.findOneAndUpdate(
        { connectionId: mapped.connectionId },
        { $set: setPayload, $setOnInsert: { createdAt: mapped.createdAt } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )

      if (updated) results.push(updated)
    } catch (err) {
      console.error(`Error upserting connection for user ${userId}:`, err?.message || err)
    }
  }

  return results
}

