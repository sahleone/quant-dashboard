import { getSnapTradeClient } from './snapTradeClient'

export async function listBrokerageAuthorizations(userId, userSecret) {
  const client = getSnapTradeClient()
  const response = await client.connections.listBrokerageAuthorizations({ userId, userSecret })
  return response.data || []
}

export async function getBrokerageAuthorizationDetails(userId, userSecret, authorizationId) {
  const client = getSnapTradeClient()
  const response = await client.connections.detailBrokerageAuthorization({
    authorizationId,
    userId,
    userSecret,
  })
  return response.data
}

export async function removeBrokerageAuthorization(userId, userSecret, authorizationId) {
  const client = getSnapTradeClient()
  const response = await client.connections.removeBrokerageAuthorization({
    authorizationId,
    userId,
    userSecret,
  })
  return response.data
}
