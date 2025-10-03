// Core domain types matching V1.1 spec

export interface Bullet {
  id: string // UUID
  noteId: string
  parentId: string | null
  depth: number
  orderSeq: number
  text: string
  spans: Span[]
  redacted: boolean
  createdAt: string // ISO timestamp
}

export interface Span {
  type: 'wikilink' | 'url' | 'tag' | 'mention'
  start: number
  end: number
  payload?: {
    target?: string
    [key: string]: unknown
  }
}

export interface Note {
  id: string // UUID
  date: string // YYYY-MM-DD
  createdAt: string
  updatedAt: string
  lastSeq: number
}

export interface Annotation {
  id: number
  bulletId: string
  type: 'task' | 'entity' | 'link' | 'label' | 'pin'
  data: AnnotationData
  createdAt: string
}

export interface AnnotationData {
  state?: 'open' | 'doing' | 'done'
  target?: string
  due?: string
  [key: string]: unknown
}

export interface AppendEvent {
  seq: number
  noteId: string
  kind: 'bullet' | 'annotation' | 'redact'
  payload: BulletPayload | AnnotationPayload | RedactPayload
  createdAt: string
}

export interface BulletPayload {
  bulletId: string
  parentId: string | null
  depth: number
  text: string
  spans: Span[]
}

export interface AnnotationPayload {
  bulletId: string
  type: string
  data: AnnotationData
}

export interface RedactPayload {
  bulletId: string
  reason?: string
}

export interface SearchResult {
  bulletId: string
  noteId: string
  date: string
  text: string
  depth: number
  parentId: string | null
  snippet?: string
}

export interface BacklinkResult {
  bulletId: string
  noteId: string
  date: string
  text: string
  depth: number
}

export interface TaskResult {
  bulletId: string
  noteId: string
  date: string
  text: string
  state: 'open' | 'doing' | 'done'
  depth: number
}
