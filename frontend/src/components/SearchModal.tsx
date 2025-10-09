import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { SearchResult } from '@/types'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (date: string, bulletId?: string) => void
}

const PAGE_SIZE = 50 // Number of results per page

export function SearchModal({ isOpen, onClose, onNavigate }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [currentPage, setCurrentPage] = useState(0)
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
      setCurrentPage(0) // Reset to first page on new search
      setSelectedIndex(0)
      setIsSearching(false)
    })
  }, [query])

  // Calculate pagination
  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const startIndex = currentPage * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const pagedResults = results.slice(startIndex, endIndex)

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Scroll selected result into view
  useEffect(() => {
    if (!isOpen || pagedResults.length === 0) return

    const selectedElement = document.querySelector(`.search-result-item-${selectedIndex}`)
    if (selectedElement) {
      selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedIndex, isOpen, pagedResults.length])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, pagedResults.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'PageDown' || (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        if (currentPage < totalPages - 1) {
          setCurrentPage(prev => prev + 1)
          setSelectedIndex(0)
        }
      } else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        if (currentPage > 0) {
          setCurrentPage(prev => prev - 1)
          setSelectedIndex(0)
        }
      } else if (e.key === 'Enter' && pagedResults[selectedIndex]) {
        e.preventDefault()
        handleSelectResult(pagedResults[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, pagedResults, selectedIndex, currentPage, totalPages, onClose])

  const handleSelectResult = (result: SearchResult) => {
    console.log('[SearchModal] Selected result:', result)
    // Navigate to the note containing this bullet and scroll to it
    onNavigate(result.date, result.bulletId)
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

          {pagedResults.map((result, index) => (
            <div
              key={result.bulletId}
              className={`search-result-item-${index}`}
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8f9fa',
            }}
          >
            <button
              onClick={() => {
                if (currentPage > 0) {
                  setCurrentPage(prev => prev - 1)
                  setSelectedIndex(0)
                }
              }}
              disabled={currentPage === 0}
              style={{
                padding: '6px 12px',
                background: currentPage === 0 ? '#f0f0f0' : 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                color: currentPage === 0 ? '#999' : '#333',
              }}
            >
              ← Previous
            </button>

            <div style={{ fontSize: '13px', color: '#666' }}>
              Page {currentPage + 1} of {totalPages}
              <span style={{ marginLeft: '8px', color: '#999' }}>
                ({results.length} total results)
              </span>
            </div>

            <button
              onClick={() => {
                if (currentPage < totalPages - 1) {
                  setCurrentPage(prev => prev + 1)
                  setSelectedIndex(0)
                }
              }}
              disabled={currentPage === totalPages - 1}
              style={{
                padding: '6px 12px',
                background: currentPage === totalPages - 1 ? '#f0f0f0' : 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                color: currentPage === totalPages - 1 ? '#999' : '#333',
              }}
            >
              Next →
            </button>
          </div>
        )}

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
          <span>PgUp/PgDn Page</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
