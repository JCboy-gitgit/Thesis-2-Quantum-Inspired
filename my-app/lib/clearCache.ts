/**
 * Clears all browser caches (Cache API, localStorage, sessionStorage)
 * Called automatically on logout / sign-out to prevent stale data bugs.
 */
export async function clearBrowserCaches(): Promise<void> {
  try {
    // 1. Clear Cache API (service worker / PWA caches)
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    // 2. Clear sessionStorage entirely
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }

    // 3. Clear localStorage except essential non-auth keys
    if (typeof localStorage !== 'undefined') {
      // Keep only the theme preference; wipe everything else
      const theme = localStorage.getItem('theme')
      localStorage.clear()
      if (theme) localStorage.setItem('theme', theme)
    }

    // 4. Unregister service workers so next load re-fetches fresh content
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }

    console.log('[clearBrowserCaches] All caches cleared successfully')
  } catch (err) {
    console.warn('[clearBrowserCaches] Partial failure:', err)
  }
}
