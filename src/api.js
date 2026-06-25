const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787'

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  })
  const type = response.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const error = new Error(body?.error?.message || response.statusText)
    error.status = response.status
    error.code = body?.error?.code
    error.details = body?.error?.details
    throw error
  }
  return body
}

export function openEvents(path, handlers) {
  const source = new EventSource(`${API_BASE}${path}`)
  for (const [name, handler] of Object.entries(handlers)) {
    if (name === 'error') continue
    source.addEventListener(name, (event) => {
      let data = {}
      try {
        data = JSON.parse(event.data || '{}')
      } catch (error) {
        Promise.resolve(handlers.error?.(source, error)).catch(() => {})
        return
      }
      Promise.resolve(handler(data, source)).catch((error) => {
        Promise.resolve(handlers.error?.(source, error)).catch(() => {})
      })
    })
  }
  source.onerror = () => {
    Promise.resolve(handlers.error?.(source)).catch(() => {})
  }
  return source
}

export const apiBaseUrl = API_BASE
