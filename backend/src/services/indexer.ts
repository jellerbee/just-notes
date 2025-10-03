/**
 * Indexer service - Updates materialized tables from append log
 * Parses spans, updates FTS, populates links table
 */

import { PrismaClient } from '../generated/prisma';
import type { Span, BulletPayload, AnnotationPayload, RedactPayload } from '../types';

const prisma = new PrismaClient();

export class Indexer {
  /**
   * Process a bullet append - creates bullet and extracts links
   */
  static async processBulletAppend(
    noteId: string,
    orderSeq: number,
    payload: BulletPayload
  ): Promise<void> {
    const { bulletId, parentId, depth, text, spans } = payload;

    // Create bullet in materialized table
    await prisma.bullet.create({
      data: {
        id: bulletId,
        noteId,
        parentId,
        depth,
        orderSeq,
        text,
        spans: spans as any, // Prisma Json type
        redacted: false,
      },
    });

    // Extract and create links from spans
    const links = this.extractLinks(spans);
    if (links.length > 0) {
      await prisma.link.createMany({
        data: links.map(link => ({
          bulletId,
          targetType: link.targetType,
          targetValue: link.targetValue,
        })),
      });
    }

    console.log(`[Indexer] Indexed bullet ${bulletId} with ${links.length} links`);
  }

  /**
   * Process an annotation append
   */
  static async processAnnotationAppend(payload: AnnotationPayload): Promise<void> {
    const { bulletId, type, data } = payload;

    await prisma.annotation.create({
      data: {
        bulletId,
        type,
        data: data as any, // Prisma Json type
      },
    });

    console.log(`[Indexer] Created annotation type=${type} for bullet ${bulletId}`);
  }

  /**
   * Process a redaction - marks bullet as redacted
   */
  static async processRedaction(payload: RedactPayload): Promise<void> {
    const { bulletId } = payload;

    await prisma.bullet.update({
      where: { id: bulletId },
      data: { redacted: true },
    });

    console.log(`[Indexer] Redacted bullet ${bulletId}`);
  }

  /**
   * Extract links from spans
   */
  private static extractLinks(spans: Span[]): Array<{
    targetType: string;
    targetValue: string;
  }> {
    const links: Array<{ targetType: string; targetValue: string }> = [];

    for (const span of spans) {
      if (span.type === 'wikilink' && span.payload?.target) {
        links.push({
          targetType: 'note',
          targetValue: span.payload.target,
        });
      } else if (span.type === 'tag' && span.payload?.target) {
        links.push({
          targetType: 'entity',
          targetValue: span.payload.target,
        });
      } else if (span.type === 'url' && span.payload?.target) {
        links.push({
          targetType: 'url',
          targetValue: span.payload.target,
        });
      }
    }

    return links;
  }

  /**
   * Update note's lastSeq watermark
   */
  static async updateNoteSeq(noteId: string, lastSeq: number): Promise<void> {
    await prisma.note.update({
      where: { id: noteId },
      data: { lastSeq },
    });
  }
}
