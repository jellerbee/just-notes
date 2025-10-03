import express from 'express';
import { PrismaClient, Prisma } from '../generated/prisma';
import type { SearchResult, BacklinkResult } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /search?q=query
 * Full-text search across all non-redacted bullets
 */
router.get('/', async (req, res, next) => {
  try {
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Use Postgres FTS with tsvector
    // Raw query for FTS performance
    const bullets = await prisma.$queryRaw<Array<{
      id: string;
      note_id: string;
      text: string;
      depth: number;
      parent_id: string | null;
      date: Date;
    }>>`
      SELECT
        b.id,
        b.note_id,
        b.text,
        b.depth,
        b.parent_id,
        n.date
      FROM bullets b
      JOIN notes n ON b.note_id = n.id
      WHERE b.redacted = false
        AND b.text_tsv @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(b.text_tsv, plainto_tsquery('english', ${query})) DESC
      LIMIT 50
    `;

    const results: SearchResult[] = bullets.map(b => ({
      bulletId: b.id,
      noteId: b.note_id,
      date: b.date.toISOString().split('T')[0],
      text: b.text,
      depth: b.depth,
      parentId: b.parent_id,
      snippet: b.text.substring(0, 200), // Simple snippet for now
    }));

    console.log(`[Search] Found ${results.length} results for "${query}"`);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /backlinks?target=NoteName
 * Find all bullets that link to the target
 */
router.get('/backlinks', async (req, res, next) => {
  try {
    const target = req.query.target as string;

    if (!target) {
      return res.status(400).json({ error: 'Missing target parameter' });
    }

    // Find links to this target
    const links = await prisma.link.findMany({
      where: {
        targetType: 'note',
        targetValue: target,
      },
      include: {
        bullet: {
          include: {
            note: true,
          },
        },
      },
    });

    const results: BacklinkResult[] = links
      .filter(link => !link.bullet.redacted)
      .map(link => ({
        bulletId: link.bullet.id,
        noteId: link.bullet.noteId,
        date: link.bullet.note.date.toISOString().split('T')[0],
        text: link.bullet.text,
        depth: link.bullet.depth,
      }));

    console.log(`[Search] Found ${results.length} backlinks to "${target}"`);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
