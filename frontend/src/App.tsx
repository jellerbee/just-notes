import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import BulletEditor from '@/components/BulletEditor'
import { SearchModal } from '@/components/SearchModal'
import { BacklinksPanel } from '@/components/BacklinksPanel'
import { TasksModal } from '@/components/TasksModal'
import type { Note } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isBacklinksOpen, setIsBacklinksOpen] = useState(false)
  const [isTasksOpen, setIsTasksOpen] = useState(false)

  useEffect(() => {
    // Load today's note on mount
    api.getTodayNote().then(setCurrentNote)
  }, [])

  // Navigate to a different note by date, optionally scrolling to a specific bullet
  const navigateToNote = async (date: string, bulletId?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notes/${date}/ensure`, {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()

        console.log('[App] Navigating to note:', date, 'noteId:', data.noteId)

        // Always update the note - BulletEditor will handle empty notes
        setCurrentNote({
          id: data.noteId,
          date: date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSeq: data.lastSeq,
          scrollToBulletId: bulletId, // Pass bulletId for scrolling
        })
      } else {
        console.error('[App] Failed to ensure note, status:', response.status)
      }
    } catch (error) {
      console.error('[App] Failed to navigate to note:', error)
      // Don't change the current note if navigation failed
    }
  }

  // Navigate to previous/next day
  const navigatePreviousDay = () => {
    if (!currentNote) return
    const currentDate = new Date(currentNote.date + 'T00:00:00')
    currentDate.setDate(currentDate.getDate() - 1)
    const prevDate = currentDate.toISOString().split('T')[0]
    navigateToNote(prevDate)
  }

  const navigateNextDay = () => {
    if (!currentNote) return
    const currentDate = new Date(currentNote.date + 'T00:00:00')
    currentDate.setDate(currentDate.getDate() + 1)
    const nextDate = currentDate.toISOString().split('T')[0]
    navigateToNote(nextDate)
  }

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K - Open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      // Cmd+B / Ctrl+B - Toggle backlinks
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setIsBacklinksOpen(prev => !prev)
      }
      // Cmd+T / Ctrl+T - Open tasks
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        setIsTasksOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!currentNote) {
    return null
  }

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'auto' }}>
      <BulletEditor
        noteId={currentNote.id}
        noteDate={currentNote.date}
        scrollToBulletId={currentNote.scrollToBulletId}
        onNavigatePrevious={navigatePreviousDay}
        onNavigateNext={navigateNextDay}
      />
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={navigateToNote}
      />
      <BacklinksPanel isOpen={isBacklinksOpen} currentNoteDate={currentNote.date} />
      <TasksModal
        isOpen={isTasksOpen}
        onClose={() => setIsTasksOpen(false)}
        onNavigate={navigateToNote}
      />
    </div>
  )
}

export default App
