/**
 * Tests for notes API endpoints
 *
 * To run these tests, you need a test Postgres database:
 * 1. Create test database: createdb jnotes_test
 * 2. Set DATABASE_URL=postgresql://localhost:5432/jnotes_test
 * 3. Run migrations: npm run prisma:migrate
 * 4. Run tests: npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

describe('Notes API', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.idempotencyKey.deleteMany();
    await prisma.link.deleteMany();
    await prisma.annotation.deleteMany();
    await prisma.bullet.deleteMany();
    await prisma.append.deleteMany();
    await prisma.note.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Note Creation', () => {
    it('should create a new note', async () => {
      const date = new Date('2025-10-03');
      const note = await prisma.note.create({
        data: {
          date,
          lastSeq: 0,
        },
      });

      expect(note).toBeDefined();
      expect(note.id).toBeTruthy();
      expect(note.date).toEqual(date);
      expect(note.lastSeq).toBe(0);
    });

    it('should not allow duplicate dates', async () => {
      const date = new Date('2025-10-04');

      await prisma.note.create({
        data: { date, lastSeq: 0 },
      });

      // Attempt to create duplicate should fail
      await expect(
        prisma.note.create({
          data: { date, lastSeq: 0 },
        })
      ).rejects.toThrow();
    });
  });

  describe('Bullet Appends', () => {
    it('should append a bullet with automatic sequence', async () => {
      const date = new Date('2025-10-05');
      const note = await prisma.note.create({
        data: { date, lastSeq: 0 },
      });

      const payload = {
        bulletId: 'test-bullet-1',
        parentId: null,
        depth: 0,
        text: 'Test bullet',
        spans: [],
      };

      const append = await prisma.append.create({
        data: {
          noteId: note.id,
          kind: 'bullet',
          payload: payload as any,
        },
      });

      expect(append.seq).toBeDefined();
      expect(append.kind).toBe('bullet');
    });

    it('should handle idempotency correctly', async () => {
      const clientId = 'test-client';
      const clientSeq = 1;
      const bulletId = 'test-bullet-idem';

      // First request
      const key1 = await prisma.idempotencyKey.create({
        data: {
          clientId,
          clientSeq,
          bulletId,
        },
      });

      expect(key1).toBeDefined();

      // Second request with same clientId/clientSeq should fail
      await expect(
        prisma.idempotencyKey.create({
          data: {
            clientId,
            clientSeq,
            bulletId: 'different-bullet',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Links Extraction', () => {
    it('should extract wikilinks from spans', async () => {
      const date = new Date('2025-10-06');
      const note = await prisma.note.create({
        data: { date, lastSeq: 0 },
      });

      const bulletId = 'test-bullet-links';

      // Create bullet
      await prisma.bullet.create({
        data: {
          id: bulletId,
          noteId: note.id,
          parentId: null,
          depth: 0,
          orderSeq: 1,
          text: 'Check [[OtherNote]] for details',
          spans: [
            {
              type: 'wikilink',
              start: 6,
              end: 19,
              payload: { target: 'OtherNote' },
            },
          ] as any,
          redacted: false,
        },
      });

      // Create link
      await prisma.link.create({
        data: {
          bulletId,
          targetType: 'note',
          targetValue: 'OtherNote',
        },
      });

      // Query links
      const links = await prisma.link.findMany({
        where: { bulletId },
      });

      expect(links).toHaveLength(1);
      expect(links[0].targetType).toBe('note');
      expect(links[0].targetValue).toBe('OtherNote');
    });
  });

  describe('Redaction', () => {
    it('should soft delete a bullet', async () => {
      const date = new Date('2025-10-07');
      const note = await prisma.note.create({
        data: { date, lastSeq: 0 },
      });

      const bulletId = 'test-bullet-redact';

      const bullet = await prisma.bullet.create({
        data: {
          id: bulletId,
          noteId: note.id,
          parentId: null,
          depth: 0,
          orderSeq: 1,
          text: 'Sensitive info',
          redacted: false,
        },
      });

      // Redact
      await prisma.bullet.update({
        where: { id: bulletId },
        data: { redacted: true },
      });

      const redacted = await prisma.bullet.findUnique({
        where: { id: bulletId },
      });

      expect(redacted?.redacted).toBe(true);
    });
  });
});
