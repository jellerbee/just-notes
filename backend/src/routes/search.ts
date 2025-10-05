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
    // Cast text_tsv to tsvector since Prisma stores it as TEXT
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
        AND b.text_tsv::tsvector @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank(b.text_tsv::tsvector, plainto_tsquery('english', ${query})) DESC
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

/**
 * GET /wikilinks?q=query
 * Search for wikilink targets (for autocomplete)
 */
router.get('/wikilinks', async (req, res, next) => {
  try {
    const query = req.query.q as string;

    // Get unique wikilink targets
    const links = await prisma.link.findMany({
      where: {
        targetType: 'note',
        ...(query && query.length > 0 && {
          targetValue: {
            contains: query,
            mode: 'insensitive',
          },
        }),
      },
      select: {
        targetValue: true,
      },
      distinct: ['targetValue'],
      take: 10,
    });

    const targets = links.map(link => link.targetValue);
    console.log(`[Search] Found ${targets.length} wikilink targets for "${query}"`);
    res.json(targets);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tags?q=query
 * Search for tag targets (for autocomplete)
 */
router.get('/tags', async (req, res, next) => {
  try {
    const query = req.query.q as string;

    // Get unique tag targets
    const links = await prisma.link.findMany({
      where: {
        targetType: 'tag',
        ...(query && query.length > 0 && {
          targetValue: {
            contains: query,
            mode: 'insensitive',
          },
        }),
      },
      select: {
        targetValue: true,
      },
      distinct: ['targetValue'],
      take: 10,
    });

    const targets = links.map(link => link.targetValue);
    console.log(`[Search] Found ${targets.length} tag targets for "${query}"`);
    res.json(targets);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tasks
 * Get all tasks from annotations
 */
router.get('/tasks', async (req, res, next) => {
  try {
    // Get all task annotations with their bullets
    const annotations = await prisma.annotation.findMany({
      where: {
        type: 'task',
      },
      include: {
        bullet: {
          include: {
            note: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by bulletId and get latest state for each task
    const taskMap = new Map();

    annotations.forEach(annotation => {
      const bulletId = annotation.bulletId;

      // Skip if bullet is redacted
      if (annotation.bullet.redacted) return;

      // Keep the latest annotation for each bullet (ordered by createdAt desc)
      if (!taskMap.has(bulletId)) {
        const state = (annotation.data as any).state || 'open';
        taskMap.set(bulletId, {
          bulletId: annotation.bullet.id,
          noteId: annotation.bullet.noteId,
          date: annotation.bullet.note.date.toISOString().split('T')[0],
          text: annotation.bullet.text,
          state,
          depth: annotation.bullet.depth,
        });
      }
    });

    const tasks = Array.from(taskMap.values());

    // Sort by date descending (newest first)
    tasks.sort((a, b) => b.date.localeCompare(a.date));

    console.log(`[Search] Found ${tasks.length} tasks`);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

export default router;
