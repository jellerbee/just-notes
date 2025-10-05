import express from 'express';
import { PrismaClient } from '../generated/prisma';
import { Indexer } from '../services/indexer';
import type { BulletPayload, AppendResponse } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /notes/:date/ensure
 * Create daily note if it doesn't exist
 */
router.post('/:date/ensure', async (req, res, next) => {
  try {
    const { date } = req.params;

    // Parse date string to Date object
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Check if note exists
    let note = await prisma.note.findUnique({
      where: { date: dateObj },
    });

    // Create if missing
    if (!note) {
      note = await prisma.note.create({
        data: {
          date: dateObj,
          lastSeq: 0,
        },
      });
      console.log(`[Notes] Created note for ${date}: ${note.id}`);
    }

    res.json({
      noteId: note.id,
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
      date: note.date.toISOString().split('T')[0],
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

    // Store idempotency key if provided
    if (payload.clientSeq !== undefined) {
      const clientId = req.headers['x-client-id'] as string || 'default';
      await prisma.idempotencyKey.create({
        data: {
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
