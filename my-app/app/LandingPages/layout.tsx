'use client'

import { useAuth } from '@/app/hooks/useAuth'
import LoadingFallback from '@/app/components/LoadingFallback'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { isLoading, isAuthenticated, isAdmin } = useAuth({
        requireAuth: true,
        requireAdmin: true,
    })

    // Block rendering until auth check completes
    if (isLoading) {
        return <LoadingFallback message="Verifying admin access..." />
    }

    // If not authenticated or not admin, the hook already handles redirection.
    // Return null to prevent flash of protected content while router navigates.
    if (!isAuthenticated || !isAdmin) {
        return null
    }

    return <>{children}</>
}
