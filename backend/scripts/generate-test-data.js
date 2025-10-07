/**
 * Generate test data for load testing
 * Creates 4000 bullets with hierarchy, wikilinks, tags, and tasks
 *
 * Usage:
 *   DATABASE_URL="your-db-url" node scripts/generate-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

// Real words to sprinkle throughout for FTS testing
const REAL_WORDS = [
  'project', 'meeting', 'deadline', 'important', 'review',
  'follow', 'discussion', 'decision', 'action', 'update'
];

// Sample wikilink targets
const WIKILINK_TARGETS = [
  'ProjectAlpha', 'TeamMeeting', 'Q4Goals', 'ClientDemo',
  'TechReview', 'BudgetPlanning', 'HiringPlan', 'MarketingCampaign'
];

// Sample tags
const TAGS = [
  'urgent', 'low-priority', 'blocked', 'in-progress',
  'review-needed', 'waiting', 'idea', 'question'
];

/**
 * Generate random word (5-10 letters)
 */
function randomWord() {
  const length = 5 + Math.floor(Math.random() * 6);
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let word = '';
  for (let i = 0; i < length; i++) {
    word += chars[Math.floor(Math.random() * chars.length)];
  }
  return word;
}

/**
 * Generate bullet text with random content, wikilinks, and tags
 */
function generateBulletText(depth) {
  const words = [];
  const spans = [];
  let currentPos = 0;
  let hasTask = false;

  // 20% chance of starting with task syntax
  if (Math.random() < 0.2) {
    const taskSyntax = Math.random() < 0.5 ? '[] ' : '[ ] ';
    words.push(taskSyntax);
    hasTask = true;
    currentPos = taskSyntax.length;
  }

  // Generate 5-15 words
  const wordCount = 5 + Math.floor(Math.random() * 11);

  for (let i = 0; i < wordCount; i++) {
    // 30% chance to use a real word for FTS testing
    const word = Math.random() < 0.3
      ? REAL_WORDS[Math.floor(Math.random() * REAL_WORDS.length)]
      : randomWord();

    words.push(word);
    currentPos += word.length + 1; // +1 for space

    // 15% chance to add a wikilink after this word
    if (Math.random() < 0.15 && i < wordCount - 1) {
      const target = WIKILINK_TARGETS[Math.floor(Math.random() * WIKILINK_TARGETS.length)];
      const wikilinkText = `[[${target}]]`;
      words.push(wikilinkText);

      spans.push({
        type: 'wikilink',
        start: currentPos,
        end: currentPos + wikilinkText.length,
        text: target,
        targetType: 'note',
        targetValue: target
      });

      currentPos += wikilinkText.length + 1;
    }

    // 10% chance to add a tag after this word
    if (Math.random() < 0.1 && i < wordCount - 1) {
      const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
      const tagText = `#${tag}`;
      words.push(tagText);

      spans.push({
        type: 'tag',
        start: currentPos,
        end: currentPos + tagText.length,
        text: tag,
        targetType: 'entity',
        targetValue: tag
      });

      currentPos += tagText.length + 1;
    }
  }

  return {
    text: words.join(' '),
    spans,
    hasTask
  };
}

/**
 * Create bullets with hierarchy
 */
async function generateTestData() {
  console.log('[Test Data] Starting generation of 4000 bullets...');

  // Create test notes for the last 30 days
  const today = new Date();
  const notes = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Find or create note for this date
    let note = await prisma.note.findUnique({
      where: { date: date },
    });

    if (!note) {
      note = await prisma.note.create({
        data: {
          noteType: 'daily',
          date: date,
          lastSeq: BigInt(0),
          testData: true,
        },
      });
      console.log(`[Test Data] Created note for ${date.toISOString().split('T')[0]}`);
    } else {
      console.log(`[Test Data] Using existing note for ${date.toISOString().split('T')[0]}`);
    }

    notes.push(note);
  }

  // Get the highest existing sequence number
  const lastAppend = await prisma.append.findFirst({
    orderBy: { seq: 'desc' },
  });

  let seq = lastAppend ? Number(lastAppend.seq) + 1 : 1;
  console.log(`[Test Data] Starting from sequence number: ${seq}`);

  // Distribute 4000 bullets across notes
  const bulletsPerNote = Math.floor(4000 / notes.length);
  let totalBullets = 0;
  let totalTasks = 0;

  for (const note of notes) {
    console.log(`[Test Data] Generating ${bulletsPerNote} bullets for note ${note.id}...`);

    const noteBullets = [];

    for (let i = 0; i < bulletsPerNote; i++) {
      // Determine depth and parent
      let depth = 0;
      let parentId = null;

      if (noteBullets.length > 0) {
        // 60% chance of being a child of previous bullet
        if (Math.random() < 0.6 && noteBullets.length > 0) {
          const parent = noteBullets[noteBullets.length - 1];
          if (parent.depth < 3) { // Max depth of 3
            depth = parent.depth + 1;
            parentId = parent.id;
          }
        }
        // 20% chance of being a sibling (same depth as previous)
        else if (Math.random() < 0.2 && noteBullets.length > 0) {
          const prev = noteBullets[noteBullets.length - 1];
          depth = prev.depth;
          parentId = prev.parentId;
        }
      }

      const { text, spans, hasTask } = generateBulletText(depth);
      const bulletId = generateUUID();

      // Insert into appends table
      await prisma.append.create({
        data: {
          seq: BigInt(seq++),
          noteId: note.id,
          kind: 'bullet',
          payload: {
            bulletId,
            parentId,
            depth,
            text,
            spans,
          },
        },
      });

      // Insert into bullets table
      const bullet = await prisma.bullet.create({
        data: {
          id: bulletId,
          noteId: note.id,
          parentId,
          depth,
          orderSeq: BigInt(seq - 1),
          text,
          spans,
        },
      });

      noteBullets.push(bullet);
      totalBullets++;

      // Create task annotation if bullet has task syntax
      if (hasTask) {
        const states = ['open', 'doing', 'done'];
        const state = states[Math.floor(Math.random() * states.length)];

        await prisma.annotation.create({
          data: {
            bulletId: bullet.id,
            type: 'task',
            data: { state },
          },
        });

        totalTasks++;
      }

      // Create links from spans
      for (const span of spans) {
        if (span.targetType && span.targetValue) {
          await prisma.link.create({
            data: {
              bulletId: bullet.id,
              targetType: span.targetType,
              targetValue: span.targetValue,
            },
          });
        }
      }

      // Log progress every 100 bullets
      if (totalBullets % 100 === 0) {
        console.log(`[Test Data] Generated ${totalBullets} bullets, ${totalTasks} tasks...`);
      }
    }

    // Update note's lastSeq
    await prisma.note.update({
      where: { id: note.id },
      data: { lastSeq: BigInt(seq - 1) },
    });
  }

  console.log(`\n[Test Data] ✅ Generation complete!`);
  console.log(`  - Total bullets: ${totalBullets}`);
  console.log(`  - Total tasks: ${totalTasks}`);
  console.log(`  - Total notes: ${notes.length}`);
  console.log(`  - Date range: ${notes[notes.length - 1].date.toISOString().split('T')[0]} to ${notes[0].date.toISOString().split('T')[0]}`);
  console.log(`\nFTS Test Queries:`);
  REAL_WORDS.slice(0, 5).forEach(word => {
    console.log(`  - Search for "${word}"`);
  });
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('[Test Data] Cleaning up test data...');

  // Find all notes marked as test data
  const notes = await prisma.note.findMany({
    where: { testData: true },
    include: {
      _count: {
        select: { bullets: true }
      }
    }
  });

  let deletedBullets = 0;
  let deletedNotes = 0;

  for (const note of notes) {
    // Delete all bullets for this note (cascades to annotations and links)
    await prisma.bullet.deleteMany({
      where: { noteId: note.id }
    });

    // Delete the note
    await prisma.note.delete({
      where: { id: note.id }
    });

    deletedBullets += note._count.bullets;
    deletedNotes++;
    console.log(`[Test Data] Deleted test note ${note.date.toISOString().split('T')[0]} with ${note._count.bullets} bullets`);
  }

  console.log(`[Test Data] ✅ Deleted ${deletedNotes} notes and ${deletedBullets} bullets`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--cleanup')) {
    await cleanupTestData();
  } else {
    await generateTestData();
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('[Test Data] Error:', error);
  process.exit(1);
});
