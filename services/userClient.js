import { getSnapTradeClient } from './snapTradeClient'
import User from '@/models/Users'
import Connection from '@/models/Connection'

export async function createSnapTradeUser(userId) {
  const client = getSnapTradeClient()
  const response = await client.authentication.registerSnapTradeUser({ userId })

  await User.updateOne(
    { userId },
    { userSecret: response.data.userSecret, createdAt: new Date(), status: 'active' }
  )

  return response.data
}

export async function getUserSecret(userId) {
  const user = await User.findOne({ userId })
  return user?.userSecret || null
}

export async function generateConnectionPortalUrl(userId, userSecret, options = {}) {
  const client = getSnapTradeClient()
  const {
    broker,
    customRedirect = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`,
    connectionType = 'read',
  } = options

  const params = {
    userId,
    userSecret,
    immediateRedirect: true,
    customRedirect,
    connectionPortalVersion: 'v4',
    connectionType,
    darkMode: true,
  }
  if (broker) {
    params.broker = broker
  }

  const response = await client.authentication.loginSnapTradeUser(params)

  return response.data
}

export async function deleteSnapTradeUser(userId) {
  const client = getSnapTradeClient()
  try {
    await client.authentication.deleteSnapTradeUser({ userId })
  } catch (err) {
    console.error(`Failed to delete SnapTrade user ${userId}:`, err.message)
  }
  await User.deleteOne({ userId })
  await Connection.deleteMany({ userId })
}
