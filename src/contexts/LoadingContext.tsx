'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface LoadingState {
  isLoading: boolean
  message?: string
  progress?: number
}

interface LoadingContextType {
  globalLoading: LoadingState
  setGlobalLoading: (state: LoadingState) => void
  showLoading: (message?: string, progress?: number) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [globalLoading, setGlobalLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: undefined,
    progress: undefined
  })

  const setGlobalLoading = useCallback((state: LoadingState) => {
    setGlobalLoadingState(state)
  }, [])

  const showLoading = useCallback((message?: string, progress?: number) => {
    setGlobalLoadingState({
      isLoading: true,
      message,
      progress
    })
  }, [])

  const hideLoading = useCallback(() => {
    setGlobalLoadingState({
      isLoading: false,
      message: undefined,
      progress: undefined
    })
  }, [])

  const updateProgress = useCallback((progress: number) => {
    setGlobalLoadingState(prev => ({
      ...prev,
      progress
    }))
  }, [])

  return (
    <LoadingContext.Provider value={{
      globalLoading,
      setGlobalLoading,
      showLoading,
      hideLoading,
      updateProgress
    }}>
      {children}
      {globalLoading.isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            {globalLoading.message && (
              <div className="text-lg font-medium">{globalLoading.message}</div>
            )}
            {globalLoading.progress !== undefined && (
              <div className="w-64 bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${globalLoading.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  )
}

export function useGlobalLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useGlobalLoading must be used within a LoadingProvider')
  }
  return context
}