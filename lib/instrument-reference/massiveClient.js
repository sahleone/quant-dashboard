import { MASSIVE_REFERENCE_BASE_URL } from './constants.js'

function massiveApiKey() {
  return process.env.MASSIVE_API_KEY?.trim() || ''
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function massiveGetWithRetry(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url)

      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(500)
        continue
      }

      let body = null
      try {
        body = await res.json()
      } catch {

      }

      return { status: res.status, body, networkError: null }
    } catch (err) {
      if (attempt < 3) {
        await sleep(500)
        continue
      }
      return { status: null, body: null, networkError: err.message || String(err) }
    }
  }
}

export async function massiveOverviewGet(tickerUpper) {
  const key = massiveApiKey()
  if (!key) {
    return { status: 401, body: null, networkError: 'MASSIVE_API_KEY not set' }
  }

  const url =
    `${MASSIVE_REFERENCE_BASE_URL}/v3/reference/tickers` +
    `/${encodeURIComponent(tickerUpper)}?apiKey=${encodeURIComponent(key)}`

  return massiveGetWithRetry(url)
}

export async function massiveCryptoOverviewGet(tickerUpper) {
  const key = massiveApiKey()
  if (!key) {
    return { status: 401, body: null, networkError: 'MASSIVE_API_KEY not set' }
  }

  const url =
    `${MASSIVE_REFERENCE_BASE_URL}/v3/reference/tickers` +
    `/X:${encodeURIComponent(tickerUpper)}USD?apiKey=${encodeURIComponent(key)}`

  return massiveGetWithRetry(url)
}

export async function massiveReferenceGet(tickerUpper) {
  const key = massiveApiKey()
  if (!key) {
    return { status: 401, body: null, networkError: 'MASSIVE_API_KEY not set' }
  }

  const url =
    `${MASSIVE_REFERENCE_BASE_URL}/v3/reference/tickers` +
    `?ticker=${encodeURIComponent(tickerUpper)}&apiKey=${encodeURIComponent(key)}`

  return massiveGetWithRetry(url)
}
