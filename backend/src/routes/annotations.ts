import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Indexer } from '../services/indexer';
import type { AnnotationPayload } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /annotations/append
 * Add an annotation to a bullet
 */
router.post('/append', async (req, res, next) => {
  try {
    const payload: AnnotationPayload = req.body;

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
        kind: 'annotation',
        payload: payload as any,
      },
    });

    // Process with indexer
    await Indexer.processAnnotationAppend(payload);

    // Update note's lastSeq
    await Indexer.updateNoteSeq(bullet.noteId, Number(append.seq));

    res.json({
      annotationId: Number(append.seq),
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
