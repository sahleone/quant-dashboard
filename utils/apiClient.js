async function request(url, options = {}) {
  const config = {
    credentials: 'include',
    ...options,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  }

  let res = await fetch(url, config)

  if (res.status === 401) {
    const authEndpoints = ['/api/auth/login', '/api/auth/signup', '/api/auth/refresh']
    const isAuthEndpoint = authEndpoints.some((ep) => url.includes(ep))

    if (!isAuthEndpoint) {
      try {
        await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
        res = await fetch(url, config)
      } catch {

      }
    }
  }

  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`)
    error.status = res.status
    try {
      error.data = await res.json()
    } catch {
      error.data = null
    }
    throw error
  }

  const data = await res.json()
  return { data, status: res.status }
}

export async function authenticatedGet(url, options = {}) {
  return request(url, { method: 'GET', ...options })
}

export async function authenticatedPost(url, data = {}, options = {}) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(data),
    ...options,
  })
}

export async function authenticatedPatch(url, data = {}, options = {}) {
  return request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(data),
    ...options,
  })
}

export async function authenticatedDelete(url, options = {}) {
  return request(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
}
