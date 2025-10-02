import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { parseMarkdownToBlocks } from '../renderer/lib/markdown/parse.js';
import type { NoteRow, BlockRow, LinkRow, TagRow, TaskRow } from '../shared/types.js';
import path from 'node:path';
import fs from 'node:fs';

// Hidden ID marker helpers
const ID_MARKER_RE = /<!--\s*\{id:\s*([0-9a-fA-F-]{36})\}\s*-->/;

export function ensureBlockIdOnLine(line: string): { lineWithId: string; id: string } {
  const m = line.match(ID_MARKER_RE);
  if (m) return { lineWithId: line, id: m[1] };
  const id = uuidv4();
  const lineWithId = `${line} <!-- {id: ${id}} -->`;
  return { lineWithId, id };
}

export function reindexFile(absPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const stat = fs.statSync(absPath);
    let content = fs.readFileSync(absPath, 'utf8');

    // Pass 1: ensure every bullet line has an ID marker
    const lines = content.split(/\r?\n/);
    let contentChanged = false;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*-\s+/.test(lines[i])) {
        const r = ensureBlockIdOnLine(lines[i]);
        if (r.lineWithId !== lines[i]) {
          lines[i] = r.lineWithId;
          contentChanged = true;
        }
      }
    }
    if (contentChanged) {
      content = lines.join('\n');
      fs.writeFileSync(absPath, content, 'utf8');
    }

    // Parse into block tree and extracted entities
    const parsed = parseMarkdownToBlocks(content);
    const title = path.basename(absPath).replace(/\.md$/i, '');

    // Start transaction and process note
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // First, check if note already exists to reuse its ID
      db.get('SELECT id FROM notes WHERE path = ?', [absPath], (selectErr, existingNote) => {
        if (selectErr) {
          db.run('ROLLBACK');
          reject(selectErr);
          return;
        }

        const noteId = existingNote ? (existingNote as any).id : uuidv4();
        const noteRow: NoteRow = {
          id: noteId,
          path: absPath,
          title,
          created_at: stat.birthtimeMs || stat.ctimeMs,
          updated_at: stat.mtimeMs,
        };

        // Upsert note
        db.run(
          `INSERT OR REPLACE INTO notes (id, path, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [noteRow.id, noteRow.path, noteRow.title, noteRow.created_at, noteRow.updated_at],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }

          // Clear existing block data for this note (with proper sequencing)
          const deleteSteps = [
            () => new Promise<void>((resolve, reject) => {
              db.run('DELETE FROM links WHERE src_block_id IN (SELECT id FROM blocks WHERE note_id = ?)', [noteRow.id], (err) => {
                if (err) reject(err); else resolve();
              });
            }),
            () => new Promise<void>((resolve, reject) => {
              db.run('DELETE FROM tags WHERE block_id IN (SELECT id FROM blocks WHERE note_id = ?)', [noteRow.id], (err) => {
                if (err) reject(err); else resolve();
              });
            }),
            () => new Promise<void>((resolve, reject) => {
              db.run('DELETE FROM tasks WHERE block_id IN (SELECT id FROM blocks WHERE note_id = ?)', [noteRow.id], (err) => {
                if (err) reject(err); else resolve();
              });
            }),
            () => new Promise<void>((resolve, reject) => {
              db.run('DELETE FROM blocks WHERE note_id = ?', [noteRow.id], (err) => {
                if (err) reject(err); else resolve();
              });
            })
          ];

          // Execute deletions sequentially, then insertions
          const runSequentially = async () => {
            try {
              // Execute all deletions first
              for (const deleteStep of deleteSteps) {
                await deleteStep();
              }

              // Insert blocks first (they are referenced by links/tags/tasks)
              const blockInsertions = parsed.blocks.map(b => {
                const block: BlockRow = {
                  id: b.id,
                  note_id: noteRow.id,
                  parent_block_id: b.parentId || null,
                  order_in_parent: b.order,
                  depth: b.depth,
                  text_md: b.textMd,
                  text_plain: b.textPlain,
                };

                return new Promise<void>((resolve, reject) => {
                  db.run(
                    `INSERT INTO blocks (id, note_id, parent_block_id, order_in_parent, depth, text_md, text_plain)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [block.id, block.note_id, block.parent_block_id, block.order_in_parent, block.depth, block.text_md, block.text_plain],
                    (err) => {
                      if (err) reject(err); else resolve();
                    }
                  );
                });
              });

              // Wait for all blocks to be inserted
              await Promise.all(blockInsertions);

              // Now insert links, tags, and tasks that reference the blocks
              const linkInsertions: Promise<void>[] = [];
              const tagInsertions: Promise<void>[] = [];
              const taskInsertions: Promise<void>[] = [];

              for (const b of parsed.blocks) {
                // Insert links for this block
                for (const l of b.links) {
                  linkInsertions.push(new Promise<void>((resolve, reject) => {
                    db.run('INSERT INTO links (src_block_id, target, kind) VALUES (?, ?, ?)', [b.id, l.target, l.kind], (err) => {
                      if (err) reject(err); else resolve();
                    });
                  }));
                }

                // Insert tags for this block
                for (const t of b.tags) {
                  tagInsertions.push(new Promise<void>((resolve, reject) => {
                    db.run('INSERT INTO tags (block_id, tag_text) VALUES (?, ?)', [b.id, t], (err) => {
                      if (err) reject(err); else resolve();
                    });
                  }));
                }

                // Insert task for this block if it exists
                if (b.task) {
                  const task = b.task;
                  taskInsertions.push(new Promise<void>((resolve, reject) => {
                    db.run('INSERT INTO tasks (block_id, state, due, priority) VALUES (?, ?, ?, ?)',
                      [b.id, task.state, task.due ?? null, task.priority ?? null], (err) => {
                        if (err) reject(err); else resolve();
                      });
                  }));
                }
              }

              // Wait for all links, tags, and tasks to be inserted
              await Promise.all([...linkInsertions, ...tagInsertions, ...taskInsertions]);

              // Rebuild FTS for contentless table
              await new Promise<void>((resolve, reject) => {
                db.run("INSERT INTO blocks_fts(blocks_fts) VALUES('delete-all')", (err) => {
                  if (err) reject(err); else resolve();
                });
              });

              await new Promise<void>((resolve, reject) => {
                db.run('INSERT INTO blocks_fts (block_id, note_id, text) SELECT id, note_id, text_plain FROM blocks', (err) => {
                  if (err) reject(err); else resolve();
                });
              });

            } catch (error) {
              throw error;
            }
          };

          // Execute the sequential operations
          runSequentially().then(() => {
            db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }).catch((error) => {
            db.run('ROLLBACK');
            reject(error);
          });
        }
      );
      }); // Close the db.get callback
    });
  });
}