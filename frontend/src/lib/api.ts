/**
 * Real API client for backend
 * Replaces mockApi with actual HTTP calls to backend server
 */

import type {
  Note,
  BulletPayload,
  SearchResult,
  BacklinkResult,
  TaskResult,
  AnnotationData,
} from '@/types';
import { auth } from './auth';
import { offlineQueue } from './offlineQueue';
import { swManager } from './serviceWorker';

// Configure API base URL (can be overridden via environment variable)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class NotesAPI {
  private clientId: string;
  private clientSeq: number = 0;

  constructor() {
    // Generate a unique client ID for this session
    this.clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get headers with auth token if available
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Client-Id': this.clientId,
    };

    const token = auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Ensure today's note exists
   */
  async getTodayNote(): Promise<Note> {
    const date = this.getTodayDate();
    const response = await fetch(`${API_BASE_URL}/notes/${date}/ensure`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to ensure note: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.noteId,
      noteType: data.noteType || 'daily',
      date: date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeq: data.lastSeq,
    };
  }

  /**
   * Append a bullet to a note
   */
  async appendBullet(
    noteId: string,
    payload: BulletPayload
  ): Promise<{ orderSeq: number; lastSeq: number }> {
    // Simulate network delay like mockApi
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Add clientSeq for idempotency
    const payloadWithSeq = {
      ...payload,
      clientSeq: ++this.clientSeq,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/notes/${noteId}/bullets/append`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payloadWithSeq),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to append bullet: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      // If offline or network error, queue the append
      if (!navigator.onLine || (error as Error).message.includes('Failed to fetch')) {
        console.log('[API] Offline, queueing append:', payload.bulletId);

        // Queue the append
        await offlineQueue.enqueue({
          noteId,
          bulletId: payload.bulletId,
          payload: payloadWithSeq,
        });

        // Update pending count
        const count = await offlineQueue.count();
        swManager.setPendingCount(count);

        // Return optimistic response
        return {
          orderSeq: Date.now(), // Temporary orderSeq
          lastSeq: Date.now(),
        };
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get bullets for a note (optionally since a sequence number)
   */
  async getBullets(noteId: string, sinceSeq?: number): Promise<any[]> {
    const url = sinceSeq
      ? `${API_BASE_URL}/notes/${noteId}?sinceSeq=${sinceSeq}`
      : `${API_BASE_URL}/notes/${noteId}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to get bullets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.bullets || [];
  }

  /**
   * Search across all bullets
   */
  async search(query: string): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    await new Promise((resolve) => setTimeout(resolve, 30));

    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get backlinks for a target (note date or entity)
   */
  async getBacklinks(target: string): Promise<BacklinkResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    const response = await fetch(
      `${API_BASE_URL}/search/backlinks?target=${encodeURIComponent(target)}`
    );

    if (!response.ok) {
      throw new Error(`Backlinks failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Append an annotation to a bullet
   */
  async appendAnnotation(
    bulletId: string,
    type: string,
    data: AnnotationData
  ): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    const response = await fetch(`${API_BASE_URL}/annotations/append`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        bulletId,
        type,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to append annotation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all tasks from annotations
   */
  async getTasks(): Promise<TaskResult[]> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    const response = await fetch(`${API_BASE_URL}/search/tasks`);

    if (!response.ok) {
      throw new Error(`Get tasks failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update task state
   */
  async updateTaskState(bulletId: string, state: 'open' | 'doing' | 'done'): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    await this.appendAnnotation(bulletId, 'task', { state });
  }

  /**
   * Redact a bullet (soft delete)
   */
  async redact(bulletId: string, reason?: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 30));

    const response = await fetch(`${API_BASE_URL}/redact`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        bulletId,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`Redaction failed: ${response.statusText}`);
    }
  }

  /**
   * Search wikilink targets (for autocomplete)
   */
  async searchNotes(query: string): Promise<Note[]> {
    // Get unique wikilink targets from the links table
    const response = await fetch(
      `${API_BASE_URL}/search/wikilinks?q=${encodeURIComponent(query || '')}`
    );

    if (!response.ok) {
      console.warn('[API] Wikilinks search failed, returning empty');
      return [];
    }

    const targets: string[] = await response.json();

    // Convert targets to Note format for compatibility
    return targets.map(target => ({
      id: target, // Use target as ID for now
      date: target,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSeq: 0,
    }));
  }

  /**
   * Search tags (for tag autocomplete)
   */
  async searchTags(query: string): Promise<string[]> {
    const response = await fetch(
      `${API_BASE_URL}/search/tags?q=${encodeURIComponent(query || '')}`
    );

    if (!response.ok) {
      console.warn('[API] Tags search failed, returning empty');
      return [];
    }

    const targets: string[] = await response.json();
    return targets;
  }

  /**
   * Sync queued offline appends
   */
  async syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
    console.log('[API] Starting offline queue sync...');

    const queue = await offlineQueue.getAll();
    if (queue.length === 0) {
      console.log('[API] No pending appends to sync');
      return { synced: 0, failed: 0 };
    }

    console.log(`[API] Syncing ${queue.length} pending appends...`);

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        // Retry the append
        const response = await fetch(`${API_BASE_URL}/notes/${item.noteId}/bullets/append`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(item.payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg = response.statusText;
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.message || errorJson.error || errorMsg;
          } catch {
            errorMsg = errorText || errorMsg;
          }
          throw new Error(`Failed to sync append (${response.status}): ${errorMsg}`);
        }

        // Success - remove from queue
        await offlineQueue.dequeue(item.id);
        synced++;
        console.log('[API] Synced append:', item.bulletId);
      } catch (error) {
        console.error('[API] Failed to sync append:', item.bulletId, error);

        // Increment retry count
        await offlineQueue.incrementRetries(item.id);

        // If too many retries, remove from queue
        if (item.retries >= 3) {
          console.warn('[API] Max retries reached, removing from queue:', item.bulletId);
          await offlineQueue.dequeue(item.id);
        }

        failed++;
      }
    }

    // Update pending count
    const remainingCount = await offlineQueue.count();
    swManager.setPendingCount(remainingCount);

    console.log(`[API] Sync complete: ${synced} synced, ${failed} failed, ${remainingCount} remaining`);

    return { synced, failed };
  }
}

export const api = new NotesAPI();
