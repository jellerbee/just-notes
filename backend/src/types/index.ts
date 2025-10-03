// Shared types matching frontend types

export interface Span {
  type: 'wikilink' | 'tag' | 'url' | 'mention';
  start: number;
  end: number;
  payload?: {
    target?: string;
    [key: string]: any;
  };
}

export interface BulletPayload {
  bulletId: string;
  parentId: string | null;
  depth: number;
  text: string;
  spans: Span[];
  clientSeq?: number; // For idempotency
}

export interface AnnotationData {
  state?: 'open' | 'doing' | 'done';
  target?: string;
  [key: string]: any;
}

export interface AnnotationPayload {
  bulletId: string;
  type: 'task' | 'entity' | 'link' | 'label' | 'pin';
  data: AnnotationData;
}

export interface RedactPayload {
  bulletId: string;
  reason?: string;
}

export interface AppendResponse {
  orderSeq: number;
  lastSeq: number;
}

export interface SearchResult {
  bulletId: string;
  noteId: string;
  date: string;
  text: string;
  depth: number;
  parentId: string | null;
  snippet: string;
}

export interface BacklinkResult {
  bulletId: string;
  noteId: string;
  date: string;
  text: string;
  depth: number;
}

export interface TaskResult {
  bulletId: string;
  noteId: string;
  date: string;
  text: string;
  state: 'open' | 'doing' | 'done';
  depth: number;
}
