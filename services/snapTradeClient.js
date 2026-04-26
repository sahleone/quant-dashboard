import { Snaptrade } from 'snaptrade-typescript-sdk'

let clientInstance = null

export function getSnapTradeClient() {
  if (clientInstance) return clientInstance

  const clientId = process.env.SNAPTRADE_CLIENT_ID
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY

  if (!clientId || !consumerKey) {
    throw new Error(
      'SnapTrade client not configured: SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY are required'
    )
  }

  clientInstance = new Snaptrade({ clientId, consumerKey })
  return clientInstance
}
