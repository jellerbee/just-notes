// Mock API for Phase 1 development (in-memory storage)
import { v4 as uuidv4 } from 'uuid'
import type {
  Note,
  Bullet,
  BulletPayload,
  SearchResult,
  BacklinkResult,
  TaskResult,
  Annotation,
  AnnotationData,
} from '@/types'

class MockNotesAPI {
  private notes: Map<string, Note> = new Map()
  private bullets: Map<string, Bullet> = new Map()
  private annotations: Map<string, Annotation[]> = new Map()
  private globalSeq = 0

  constructor() {
    // Initialize with today's note
    this.ensureNote(this.getTodayDate())
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0]
  }

  async ensureNote(date: string): Promise<Note> {
    const existing = Array.from(this.notes.values()).find((n) => n.date === date)
    if (existing) return existing

    const note: Note = {
      id: uuidv4(),
      date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeq: 0,
    }
    this.notes.set(note.id, note)
    return note
  }

  async appendBullet(
    noteId: string,
    payload: BulletPayload
  ): Promise<{ orderSeq: number; lastSeq: number }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50))

    const note = this.notes.get(noteId)
    if (!note) throw new Error('Note not found')

    this.globalSeq++
    const orderSeq = this.globalSeq

    const bullet: Bullet = {
      id: payload.bulletId,
      noteId,
      parentId: payload.parentId,
      depth: payload.depth,
      orderSeq,
      text: payload.text,
      spans: payload.spans,
      redacted: false,
      createdAt: new Date().toISOString(),
    }

    this.bullets.set(bullet.id, bullet)

    note.lastSeq = orderSeq
    note.updatedAt = new Date().toISOString()
    this.notes.set(noteId, note)

    console.log('[MockAPI] Appended bullet:', bullet)

    return { orderSeq, lastSeq: orderSeq }
  }

  async getBullets(noteId: string, sinceSeq?: number): Promise<Bullet[]> {
    const bullets = Array.from(this.bullets.values())
      .filter((b) => b.noteId === noteId && !b.redacted)
      .filter((b) => !sinceSeq || b.orderSeq > sinceSeq)
      .sort((a, b) => a.orderSeq - b.orderSeq)

    console.log(`[MockAPI] Get bullets for note ${noteId}, since ${sinceSeq}:`, bullets.length)
    return bullets
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return []

    await new Promise((resolve) => setTimeout(resolve, 30))

    const results = Array.from(this.bullets.values())
      .filter((b) => !b.redacted)
      .filter((b) => b.text.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50)
      .map((b) => {
        const note = this.notes.get(b.noteId)!
        return {
          bulletId: b.id,
          noteId: b.noteId,
          date: note.date,
          text: b.text,
          depth: b.depth,
          parentId: b.parentId,
          snippet: b.text,
        }
      })

    console.log(`[MockAPI] Search "${query}":`, results.length, 'results')
    return results
  }

  async getBacklinks(target: string): Promise<BacklinkResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const results = Array.from(this.bullets.values())
      .filter((b) => !b.redacted)
      .filter((b) => b.spans.some((s) => s.type === 'wikilink' && s.payload?.target === target))
      .map((b) => {
        const note = this.notes.get(b.noteId)!
        return {
          bulletId: b.id,
          noteId: b.noteId,
          date: note.date,
          text: b.text,
          depth: b.depth,
        }
      })

    console.log(`[MockAPI] Backlinks for "${target}":`, results.length)
    return results
  }

  async redact(bulletId: string, reason?: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const bullet = this.bullets.get(bulletId)
    if (!bullet) throw new Error('Bullet not found')

    bullet.redacted = true
    this.bullets.set(bulletId, bullet)

    console.log(`[MockAPI] Redacted bullet ${bulletId}:`, reason)
  }

  async appendAnnotation(
    bulletId: string,
    type: string,
    data: AnnotationData
  ): Promise<Annotation> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const bullet = this.bullets.get(bulletId)
    if (!bullet) throw new Error('Bullet not found')

    const annotation: Annotation = {
      id: Date.now(),
      bulletId,
      type,
      data,
      createdAt: new Date().toISOString(),
    }

    const existing = this.annotations.get(bulletId) || []
    this.annotations.set(bulletId, [...existing, annotation])

    console.log(`[MockAPI] Added annotation to ${bulletId}:`, annotation)
    return annotation
  }

  async getAnnotations(bulletId: string): Promise<Annotation[]> {
    return this.annotations.get(bulletId) || []
  }

  async getTodayNote(): Promise<Note> {
    return this.ensureNote(this.getTodayDate())
  }

  async searchNotes(query: string): Promise<Note[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))

    const allNotes = Array.from(this.notes.values())

    // If no query, return all notes (sorted by date desc)
    if (!query || query.length === 0) {
      const results = allNotes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
      console.log(`[MockAPI] Note search (all):`, results.length, 'results')
      return results
    }

    // Search by date substring
    const results = allNotes
      .filter((note) => note.date.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)

    console.log(`[MockAPI] Note search "${query}":`, results.length, 'results')
    return results
  }

  async searchTags(query: string): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Extract all unique tags from all bullets
    const allTags = new Set<string>()
    Array.from(this.bullets.values()).forEach((bullet) => {
      bullet.spans
        .filter((span) => span.type === 'tag')
        .forEach((span) => {
          if (span.payload?.target) {
            allTags.add(span.payload.target)
          }
        })
    })

    const tagsArray = Array.from(allTags)

    // If no query, return all tags
    if (!query || query.length === 0) {
      const results = tagsArray.slice(0, 10)
      console.log(`[MockAPI] Tag search (all):`, results.length, 'results')
      return results
    }

    // Filter by query
    const results = tagsArray
      .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10)

    console.log(`[MockAPI] Tag search "${query}":`, results.length, 'results')
    return results
  }

  async getTasks(): Promise<TaskResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const tasks: TaskResult[] = []

    // Get all bullets with task annotations
    Array.from(this.annotations.entries()).forEach(([bulletId, annotations]) => {
      const taskAnnotations = annotations.filter(a => a.type === 'task')
      if (taskAnnotations.length === 0) return

      const bullet = this.bullets.get(bulletId)
      if (!bullet || bullet.redacted) return

      const note = this.notes.get(bullet.noteId)
      if (!note) return

      // Use the latest task annotation
      const latestTask = taskAnnotations[taskAnnotations.length - 1]
      const state = latestTask.data.state || 'open'

      tasks.push({
        bulletId: bullet.id,
        noteId: bullet.noteId,
        date: note.date,
        text: bullet.text,
        state,
        depth: bullet.depth,
      })
    })

    // Sort by date descending (newest first)
    tasks.sort((a, b) => b.date.localeCompare(a.date))

    console.log(`[MockAPI] Found ${tasks.length} tasks`)
    return tasks
  }

  async updateTaskState(bulletId: string, state: 'open' | 'doing' | 'done'): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    // Create new annotation with updated state
    const annotation: Annotation = {
      id: Date.now(),
      bulletId,
      type: 'task',
      data: { state },
      createdAt: new Date().toISOString(),
    }

    const existing = this.annotations.get(bulletId) || []
    this.annotations.set(bulletId, [...existing, annotation])

    console.log(`[MockAPI] Updated task ${bulletId} to ${state}`)
  }

  // Helper for development: get all data
  getState() {
    return {
      notes: Array.from(this.notes.values()),
      bullets: Array.from(this.bullets.values()),
      annotations: Array.from(this.annotations.entries()),
    }
  }
}

// Singleton instance
export const mockApi = new MockNotesAPI()
