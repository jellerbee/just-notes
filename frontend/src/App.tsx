import { useState, useEffect } from 'react'
import { mockApi } from '@/lib/mockApi'
import BulletEditor from '@/components/BulletEditor'
import { SearchModal } from '@/components/SearchModal'
import { BacklinksPanel } from '@/components/BacklinksPanel'
import { TasksModal } from '@/components/TasksModal'
import type { Note } from '@/types'

function App() {
  const [currentNote, setCurrentNote] = useState<Note | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isBacklinksOpen, setIsBacklinksOpen] = useState(false)
  const [isTasksOpen, setIsTasksOpen] = useState(false)

  useEffect(() => {
    // Load today's note on mount
    mockApi.getTodayNote().then(setCurrentNote)
  }, [])

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
      <BulletEditor noteId={currentNote.id} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <BacklinksPanel isOpen={isBacklinksOpen} currentNoteDate={currentNote.date} />
      <TasksModal isOpen={isTasksOpen} onClose={() => setIsTasksOpen(false)} />
    </div>
  )
}

export default App
