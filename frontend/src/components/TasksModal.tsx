import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { TaskResult } from '@/types'

interface TasksModalProps {
  isOpen: boolean
  onClose: () => void
}

type FilterMode = 'active' | 'all' | 'done'
type DateRange = 'today' | 'week' | 'month' | 'all'

export function TasksModal({ isOpen, onClose }: TasksModalProps) {
  const [tasks, setTasks] = useState<TaskResult[]>([])
  const [filteredTasks, setFilteredTasks] = useState<TaskResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [filterMode, setFilterMode] = useState<FilterMode>('active')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [locallyModified, setLocallyModified] = useState<Set<string>>(new Set())

  // Load tasks when modal opens
  useEffect(() => {
    if (!isOpen) return

    setIsLoading(true)
    setLocallyModified(new Set()) // Reset modified set on reload
    api.getTasks().then((results) => {
      setTasks(results)
      setSelectedIndex(0)
      setIsLoading(false)
    })
  }, [isOpen])

  // Apply filter when tasks or filter mode changes
  useEffect(() => {
    let filtered = tasks

    // Apply status filter
    if (filterMode === 'active') {
      // Show active tasks OR tasks that were locally modified (even if now done)
      filtered = tasks.filter(t =>
        t.state === 'open' ||
        t.state === 'doing' ||
        locallyModified.has(t.bulletId)
      )
    } else if (filterMode === 'done') {
      filtered = tasks.filter(t => t.state === 'done')
    }
    // 'all' shows everything

    // Apply date range filter
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()

    if (dateRange === 'today') {
      filtered = filtered.filter(t => t.date === today)
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date >= weekAgo)
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      filtered = filtered.filter(t => t.date >= monthAgo)
    }
    // 'all' shows all dates

    setFilteredTasks(filtered)
    setSelectedIndex(0)
  }, [tasks, filterMode, dateRange, locallyModified])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredTasks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === ' ') {
        e.preventDefault()
        cycleTaskState(filteredTasks[selectedIndex])
      } else if (e.key === 'Enter' && filteredTasks[selectedIndex]) {
        e.preventDefault()
        handleNavigateToTask(filteredTasks[selectedIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredTasks, selectedIndex, onClose])

  const cycleTaskState = async (task: TaskResult) => {
    if (!task) return

    // Cycle: open → doing → done → open
    let newState: 'open' | 'doing' | 'done'
    if (task.state === 'open') {
      newState = 'doing'
    } else if (task.state === 'doing') {
      newState = 'done'
    } else {
      newState = 'open'
    }

    await api.updateTaskState(task.bulletId, newState)

    // Mark as locally modified so it stays visible despite filter
    setLocallyModified(prev => new Set(prev).add(task.bulletId))

    // Update local state (keeps item visible even if it no longer matches filter)
    setTasks(prevTasks =>
      prevTasks.map(t => t.bulletId === task.bulletId ? { ...t, state: newState } : t)
    )
  }

  const toggleTaskDone = async (task: TaskResult) => {
    if (!task) return

    // Toggle: open/doing ↔ done
    const newState = task.state === 'done' ? 'open' : 'done'

    await api.updateTaskState(task.bulletId, newState)

    // Mark as locally modified so it stays visible despite filter
    setLocallyModified(prev => new Set(prev).add(task.bulletId))

    // Update local state
    setTasks(prevTasks =>
      prevTasks.map(t => t.bulletId === task.bulletId ? { ...t, state: newState } : t)
    )
  }

  const handleNavigateToTask = (task: TaskResult) => {
    console.log('[TasksModal] Navigate to task:', task)
    // TODO: Navigate to note and scroll to bullet
    onClose()
  }

  const getCheckboxDisplay = (state: 'open' | 'doing' | 'done') => {
    if (state === 'done') return '[x]'
    if (state === 'doing') return '[~]'
    return '[ ]'
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
        paddingTop: '10vh',
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
          maxWidth: '800px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
            Master Tasks
          </h2>

          {/* Status filter buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setFilterMode('active')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: filterMode === 'active' ? '#007acc' : 'white',
                color: filterMode === 'active' ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: filterMode === 'active' ? 600 : 400,
              }}
            >
              Active ({tasks.filter(t => t.state === 'open' || t.state === 'doing').length})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: filterMode === 'all' ? '#007acc' : 'white',
                color: filterMode === 'all' ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: filterMode === 'all' ? 600 : 400,
              }}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilterMode('done')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: filterMode === 'done' ? '#007acc' : 'white',
                color: filterMode === 'done' ? 'white' : '#333',
                cursor: 'pointer',
                fontWeight: filterMode === 'done' ? 600 : 400,
              }}
            >
              Done ({tasks.filter(t => t.state === 'done').length})
            </button>
          </div>

          {/* Date range filter */}
          <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: '#666', marginRight: '4px' }}>Date:</span>
            <button
              onClick={() => setDateRange('today')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                background: dateRange === 'today' ? '#28a745' : 'white',
                color: dateRange === 'today' ? 'white' : '#666',
                cursor: 'pointer',
              }}
            >
              Today
            </button>
            <button
              onClick={() => setDateRange('week')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                background: dateRange === 'week' ? '#28a745' : 'white',
                color: dateRange === 'week' ? 'white' : '#666',
                cursor: 'pointer',
              }}
            >
              Week
            </button>
            <button
              onClick={() => setDateRange('month')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                background: dateRange === 'month' ? '#28a745' : 'white',
                color: dateRange === 'month' ? 'white' : '#666',
                cursor: 'pointer',
              }}
            >
              Month
            </button>
            <button
              onClick={() => setDateRange('all')}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                background: dateRange === 'all' ? '#28a745' : 'white',
                color: dateRange === 'all' ? 'white' : '#666',
                cursor: 'pointer',
              }}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Tasks list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {isLoading && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              Loading tasks...
            </div>
          )}

          {!isLoading && filteredTasks.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              No tasks found
            </div>
          )}

          {filteredTasks.map((task, index) => (
            <div
              key={task.bulletId}
              onClick={() => setSelectedIndex(index)}
              style={{
                padding: '12px',
                margin: '4px 0',
                cursor: 'pointer',
                background: index === selectedIndex ? '#e6f2fb' : 'white',
                borderLeft: index === selectedIndex ? '4px solid #007acc' : '4px solid transparent',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Checkbox */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTaskDone(task)
                }}
                style={{
                  fontSize: '16px',
                  fontFamily: 'monospace',
                  width: '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: task.state === 'done' ? '#28a745' : '#666',
                  fontWeight: task.state === 'done' ? 'bold' : 'normal',
                }}
              >
                {getCheckboxDisplay(task.state)}
              </div>

              {/* Task content */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                  {task.date}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: task.state === 'done' ? '#999' : '#333',
                    textDecoration: task.state === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {task.text}
                </div>
              </div>

              {/* State badge */}
              {task.state === 'doing' && (
                <div
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    background: '#ffc107',
                    color: '#333',
                    borderRadius: '3px',
                    fontWeight: 600,
                  }}
                >
                  DOING
                </div>
              )}
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
          <span>Space Cycle Status</span>
          <span>Click Checkbox Toggle Done</span>
          <span>Enter Go to Task</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
