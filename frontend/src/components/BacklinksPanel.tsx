import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { BacklinkResult } from '@/types'

interface BacklinksPanelProps {
  isOpen: boolean
  currentNoteDate: string // Use date as the target for backlinks
}

export function BacklinksPanel({ isOpen, currentNoteDate }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<BacklinkResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load backlinks when panel opens or note changes
  useEffect(() => {
    if (!isOpen) return

    setIsLoading(true)
    api.getBacklinks(currentNoteDate).then((results) => {
      setBacklinks(results)
      setIsLoading(false)
    })
  }, [isOpen, currentNoteDate])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '350px',
        background: '#f9f9f9',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #e0e0e0',
          background: 'white',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          Backlinks
        </h2>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          References to this note
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        {isLoading && (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            Loading backlinks...
          </div>
        )}

        {!isLoading && backlinks.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
            No backlinks found
          </div>
        )}

        {!isLoading && backlinks.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              {backlinks.length} reference{backlinks.length === 1 ? '' : 's'}
            </div>

            {backlinks.map((backlink) => (
              <div
                key={backlink.bulletId}
                style={{
                  background: 'white',
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#007acc'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 122, 204, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                onClick={() => {
                  console.log('[Backlinks] Navigate to:', backlink)
                  // TODO: Navigate to note and scroll to bullet
                }}
              >
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                  {backlink.date}
                </div>
                <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.4' }}>
                  {backlink.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e0e0e0',
          background: 'white',
          fontSize: '11px',
          color: '#999',
        }}
      >
        Cmd+B to toggle
      </div>
    </div>
  )
}
