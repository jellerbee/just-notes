import { useEffect, useState } from 'react'
import { swManager } from '@/lib/serviceWorker'
import { offlineQueue } from '@/lib/offlineQueue'
import type { SWRegistration } from '@/lib/serviceWorker'

export function SyncStatus({ onSyncRequest }: { onSyncRequest: () => void }) {
  const [state, setState] = useState<SWRegistration>(swManager.getState())
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Subscribe to SW state changes
    const unsubscribe = swManager.subscribe(setState)

    // Update pending count periodically
    const updateCount = async () => {
      const count = await offlineQueue.count()
      swManager.setPendingCount(count)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000) // Every 5 seconds

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await onSyncRequest()
    } finally {
      setIsSyncing(false)
    }
  }

  const { isOnline, pendingCount } = state

  // Determine status
  let statusColor = '#28a745' // Green = online
  let statusText = 'Online'

  if (!isOnline) {
    statusColor = '#dc3545' // Red = offline
    statusText = 'Offline'
  } else if (isSyncing) {
    statusColor = '#ffc107' // Yellow = syncing
    statusText = 'Syncing...'
  } else if (pendingCount > 0) {
    statusColor = '#ffc107' // Yellow = pending
    statusText = `${pendingCount} pending`
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '20px',
        padding: '8px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontSize: '13px',
        fontWeight: '500',
        zIndex: 999,
      }}
    >
      {/* Status indicator dot */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: statusColor,
        }}
      />

      {/* Status text */}
      <span style={{ color: '#333' }}>{statusText}</span>

      {/* Manual sync button (show if offline with pending or sync not supported) */}
      {pendingCount > 0 && isOnline && (
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          style={{
            marginLeft: '8px',
            padding: '4px 12px',
            background: isSyncing ? '#f8f9fa' : '#007acc',
            color: isSyncing ? '#999' : 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isSyncing ? 'not-allowed' : 'pointer',
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}
    </div>
  )
}
