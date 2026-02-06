/**
 * Utility functions for fetching data with cache busting
 * Use these functions instead of raw fetch() to ensure fresh data from APIs
 */

/**
 * Fetch data without any caching - always gets fresh data from the server
 * @param url - The URL to fetch from
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function fetchNoCache(url: string, options?: RequestInit): Promise<Response> {
  // Add cache-busting query parameter
  const cacheBuster = `_t=${Date.now()}`
  const separator = url.includes('?') ? '&' : '?'
  const urlWithCacheBuster = `${url}${separator}${cacheBuster}`

  return fetch(urlWithCacheBuster, {
    ...options,
    cache: 'no-store',
    headers: {
      ...options?.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}

/**
 * Fetch JSON data without any caching
 * @param url - The URL to fetch from
 * @param options - Additional fetch options
 * @returns Promise<T> - Parsed JSON response
 */
export async function fetchJsonNoCache<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetchNoCache(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Fetch failed: ${response.status} ${response.statusText} - ${error}`)
  }

  return response.json()
}

/**
 * Fetch with automatic refresh after mutation
 * Call this after any create/update/delete operation to refresh related data
 * @param refreshUrls - Array of API URLs to refresh
 * @param callbacks - Optional callbacks to handle refreshed data
 */
export async function refreshAfterMutation(
  refreshUrls: string[],
  callbacks?: { [url: string]: (data: any) => void }
): Promise<void> {
  const refreshPromises = refreshUrls.map(async (url) => {
    try {
      const data = await fetchJsonNoCache(url)
      if (callbacks && callbacks[url]) {
        callbacks[url](data)
      }
      return { url, data, success: true }
    } catch (error) {
      console.error(`Failed to refresh ${url}:`, error)
      return { url, error, success: false }
    }
  })

  await Promise.all(refreshPromises)
}
