import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Qtime Scheduler',
    short_name: 'Qtime',
    description: 'Quantum-Inspired Room Scheduling System',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0e27',
    theme_color: '#10b981',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml'
      },
      {
        src: '/maskable-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ]
  }
}
