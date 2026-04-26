export const KNOWN_MARKETS = ['stocks', 'crypto', 'fx', 'otc', 'indices']
export const SUPPORTED_PRICE_MARKETS = ['stocks', 'crypto']

export const STALE_OVERVIEW_DAYS = 90
export const STALE_OVERVIEW_ERROR_DAYS = 1
export const OVERVIEW_FETCH_CONCURRENCY = 3

export const MASSIVE_REFERENCE_BASE_URL = (
  process.env.MASSIVE_API_BASE || 'https://api.massive.com'
).trim()
