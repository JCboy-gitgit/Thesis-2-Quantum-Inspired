"use client"

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#f1f5f9',
          backdropFilter: 'blur(10px)',
        },
        classNames: {
          success: 'border-emerald-500/50',
          error: 'border-red-500/50',
          warning: 'border-yellow-500/50',
          info: 'border-blue-500/50',
        },
      }}
      richColors
      closeButton
      duration={5000}
    />
  )
}
