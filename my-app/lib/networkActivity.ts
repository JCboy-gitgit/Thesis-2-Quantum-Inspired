let activeRequests = 0
const listeners = new Set<(count: number) => void>()
let fetchPatched = false

function emit() {
  for (const listener of listeners) {
    listener(activeRequests)
  }
}

export function subscribeNetworkActivity(listener: (count: number) => void) {
  listeners.add(listener)
  listener(activeRequests)

  return () => {
    listeners.delete(listener)
  }
}

export function beginNetworkActivity() {
  activeRequests += 1
  emit()
}

export function endNetworkActivity() {
  activeRequests = Math.max(0, activeRequests - 1)
  emit()
}

export function patchWindowFetchForProgress() {
  if (typeof window === 'undefined' || fetchPatched) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    beginNetworkActivity()
    try {
      return await originalFetch(...args)
    } finally {
      endNetworkActivity()
    }
  }

  fetchPatched = true
}

export function getActiveNetworkRequests() {
  return activeRequests
}
