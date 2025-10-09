import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Indexer } from '../services/indexer';
import type { BulletPayload, AppendResponse } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /notes/:identifier/ensure
 * Create note if it doesn't exist (supports both dates and arbitrary titles)
 */
router.post('/:identifier/ensure', async (req, res, next) => {
  try {
    const { identifier } = req.params;

    let note;

    // Try to parse as date (YYYY-MM-DD format)
    const dateMatch = identifier.match(/^\d{4}-\d{2}-\d{2}$/);

    if (dateMatch) {
      // It's a date - create/get daily note
      const dateObj = new Date(identifier);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Check if note exists
      note = await prisma.note.findUnique({
        where: { date: dateObj },
      });

      // Create if missing
      if (!note) {
        note = await prisma.note.create({
          data: {
            noteType: 'daily',
            date: dateObj,
            lastSeq: 0,
          },
        });
        console.log(`[Notes] Created daily note for ${identifier}: ${note.id}`);
      }
    } else {
      // It's an arbitrary title - create/get named note
      note = await prisma.note.findUnique({
        where: { title: identifier },
      });

      // Create if missing
      if (!note) {
        note = await prisma.note.create({
          data: {
            noteType: 'named',
            title: identifier,
            lastSeq: 0,
          },
        });
        console.log(`[Notes] Created named note "${identifier}": ${note.id}`);
      }
    }

    res.json({
      noteId: note.id,
      noteType: note.noteType,
      lastSeq: note.lastSeq,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notes/:noteId
 * Get bullets for a note, optionally since a sequence number
 */
router.get('/:noteId', async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const sinceSeq = req.query.sinceSeq ? parseInt(req.query.sinceSeq as string, 10) : undefined;

    // Get note
    const note = await prisma.note.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Get bullets
    const bullets = await prisma.bullet.findMany({
      where: {
        noteId,
        redacted: false,
        ...(sinceSeq !== undefined && { orderSeq: { gt: sinceSeq } }),
      },
      orderBy: { orderSeq: 'asc' },
    });

    res.json({
      noteId: note.id,
      date: note.date ? note.date.toISOString().split('T')[0] : note.title || '',
      bullets,
      lastSeq: note.lastSeq,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notes/:noteId/bullets/append
 * Append a single bullet
 */
router.post('/:noteId/bullets/append', async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const payload: BulletPayload = req.body;

    // Validate note exists
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check idempotency if clientSeq provided
    if (payload.clientSeq !== undefined) {
      const clientId = req.headers['x-client-id'] as string || 'default';
      const existing = await prisma.idempotencyKey.findUnique({
        where: {
          clientId_clientSeq: {
            clientId,
            clientSeq: payload.clientSeq,
          },
        },
      });

      if (existing) {
        // Already processed - return existing bullet's orderSeq
        const bullet = await prisma.bullet.findUnique({
          where: { id: existing.bulletId },
        });
        return res.json({
          orderSeq: Number(bullet?.orderSeq || 0),
          lastSeq: Number(note.lastSeq),
        } as AppendResponse);
      }
    }

    // Append to log
    const append = await prisma.append.create({
      data: {
        noteId,
        kind: 'bullet',
        payload: payload as any,
      },
    });

    const orderSeq = Number(append.seq);

    // Process with indexer
    await Indexer.processBulletAppend(noteId, orderSeq, payload);
    await Indexer.updateNoteSeq(noteId, orderSeq);

    // Store idempotency key if provided (upsert to handle retries)
    if (payload.clientSeq !== undefined) {
      const clientId = req.headers['x-client-id'] as string || 'default';
      await prisma.idempotencyKey.upsert({
        where: {
          clientId_clientSeq: {
            clientId,
            clientSeq: payload.clientSeq,
          },
        },
        update: {
          // Key already exists, no update needed
        },
        create: {
          clientId,
          clientSeq: payload.clientSeq,
          bulletId: payload.bulletId,
        },
      });
    }

    res.json({
      orderSeq,
      lastSeq: orderSeq,
    } as AppendResponse);
  } catch (error) {
    console.error('[Notes] Error appending bullet:', {
      noteId: req.params.noteId,
      bulletId: req.body.bulletId,
      clientSeq: req.body.clientSeq,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * POST /notes/:noteId/bullets/appendBatch
 * Bulk append for migration
 */
router.post('/:noteId/bullets/appendBatch', async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const bullets: BulletPayload[] = req.body;

    // Validate note exists
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const results: AppendResponse[] = [];

    // Process each bullet sequentially to maintain order
    for (const payload of bullets) {
      // Append to log
      const append = await prisma.append.create({
        data: {
          noteId,
          kind: 'bullet',
          payload: payload as any,
        },
      });

      const orderSeq = Number(append.seq);

      // Process with indexer
      await Indexer.processBulletAppend(noteId, orderSeq, payload);

      results.push({ orderSeq, lastSeq: orderSeq });
    }

    // Update note's lastSeq
    const lastSeq = results[results.length - 1]?.lastSeq || Number(note.lastSeq);
    await Indexer.updateNoteSeq(noteId, Number(lastSeq));

    res.json({
      count: results.length,
      lastSeq,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
