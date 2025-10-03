import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { SearchResult } from '@/types'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)

  // Search when query changes
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    api.search(query).then((results) => {
      setResults(results)
      setSelectedIndex(0)
      setIsSearching(false)
    })
  }, [query])

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        handleSelectResult(results[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, onClose])

  const handleSelectResult = (result: SearchResult) => {
    console.log('[SearchModal] Selected result:', result)
    // TODO: Navigate to note and scroll to bullet
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <input
            type="text"
            placeholder="Search bullets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              outline: 'none',
            }}
          />
        </div>

        {/* Results */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {isSearching && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
              Searching...
            </div>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
              No results found
            </div>
          )}

          {!isSearching && query.length < 2 && (
            <div style={{ padding: '16px', textAlign: 'center', color: '#999' }}>
              Type at least 2 characters to search
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={result.bulletId}
              onClick={() => handleSelectResult(result)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: index === selectedIndex ? '#f0f0f0' : 'white',
                borderLeft: index === selectedIndex ? '3px solid #007acc' : '3px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                {result.date}
              </div>
              <div style={{ fontSize: '14px', color: '#333' }}>
                {result.snippet}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #e0e0e0',
            fontSize: '12px',
            color: '#999',
            display: 'flex',
            gap: '16px',
          }}
        >
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
