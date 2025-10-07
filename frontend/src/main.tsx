import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { swManager } from './lib/serviceWorker'
import { offlineQueue } from './lib/offlineQueue'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Initialize offline queue
offlineQueue.init().catch(console.error)

// Register service worker in production
if (import.meta.env.PROD) {
  swManager.register().catch(console.error)
} else {
  console.log('[SW] Skipping service worker in development')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
