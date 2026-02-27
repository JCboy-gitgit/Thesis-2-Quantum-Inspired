'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface SchedulingProgress {
    isScheduling: boolean
    timer: number
    result: any | null
    config: any | null
}

interface SchedulingContextType {
    isScheduling: boolean
    timer: number
    result: any | null
    startScheduling: (config: any) => void
    setResult: (result: any) => void
    resetScheduling: () => void
}

const SchedulingContext = createContext<SchedulingContextType | undefined>(undefined)

export function SchedulingProvider({ children }: { children: React.ReactNode }) {
    const [isScheduling, setIsScheduling] = useState(false)
    const [timer, setTimer] = useState(0)
    const [result, setResultState] = useState<any | null>(null)
    const [config, setConfig] = useState<any | null>(null)

    // Interval for timer
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        if (isScheduling) {
            interval = setInterval(() => {
                setTimer(prev => prev + 100)
            }, 100)
        }
        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isScheduling])

    const startScheduling = useCallback((newConfig: any) => {
        setIsScheduling(true)
        setTimer(0)
        setResultState(null)
        setConfig(newConfig)
    }, [])

    const setResult = useCallback((newResult: any) => {
        setResultState(newResult)
        setIsScheduling(false)
    }, [])

    const resetScheduling = useCallback(() => {
        setIsScheduling(false)
        setTimer(0)
        setResultState(null)
        setConfig(null)
    }, [])

    return (
        <SchedulingContext.Provider value={{
            isScheduling,
            timer,
            result,
            startScheduling,
            setResult,
            resetScheduling
        }}>
            {children}
        </SchedulingContext.Provider>
    )
}

export function useScheduling() {
    const context = useContext(SchedulingContext)
    if (context === undefined) {
        throw new Error('useScheduling must be used within a SchedulingProvider')
    }
    return context
}
