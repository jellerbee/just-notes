import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Indexer } from '../services/indexer';
import type { RedactPayload } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /redact
 * Soft delete a bullet
 */
router.post('/', async (req, res, next) => {
  try {
    const payload: RedactPayload = req.body;

    // Validate bullet exists
    const bullet = await prisma.bullet.findUnique({
      where: { id: payload.bulletId },
    });

    if (!bullet) {
      return res.status(404).json({ error: 'Bullet not found' });
    }

    // Append to log
    const append = await prisma.append.create({
      data: {
        noteId: bullet.noteId,
        kind: 'redact',
        payload: payload as any,
      },
    });

    // Process with indexer
    await Indexer.processRedaction(payload);

    // Update note's lastSeq
    await Indexer.updateNoteSeq(bullet.noteId, Number(append.seq));

    res.json({
      success: true,
      bulletId: payload.bulletId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
