import { getSnapTradeClient } from './snapTradeClient'

export async function listBrokerages() {
  const client = getSnapTradeClient()
  const response = await client.referenceData.listAllBrokerages()
  return Array.isArray(response.data) ? response.data : []
}
