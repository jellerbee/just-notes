import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDb, getDb } from './db.js';
import { ensureDailyNote, readFileAbs, writeFileAbs } from './fs.js';
import { reindexFile } from './indexer.js';

let win: BrowserWindow | null = null;

async function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Disable web security for local files
      allowRunningInsecureContent: true
    },
  });

  // Open dev tools for debugging
  win.webContents.openDevTools();

  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) await win.loadURL(dev);
  else {
    // Load the simple working version
    const simpleFile = path.join(process.cwd(), 'simple.html');
    console.log('Loading simple note editor:', simpleFile);
    await win.loadFile(simpleFile);
  }

  // Add error handling
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
  });

  win.on('closed', () => {
    console.log('Window closed');
    win = null;
  });

  win.on('close', (event) => {
    console.log('Window close event triggered');
  });
}

app.whenReady().then(async () => {
  try {
    console.log('App starting...');
    const vaultRoot = path.join(app.getPath('documents'), 'NotesVault');
    const dbFile = path.join(vaultRoot, '.index', 'notes.db');
    const schemaFile = path.join(process.cwd(), 'sqlite', 'schema.sql');

    console.log('Testing database initialization...');
    console.log('Opening database:', dbFile);
    console.log('Schema file:', schemaFile);
    await openDb(dbFile, schemaFile);
    console.log('Database opened successfully');

    await createWindow();
    console.log('Window created successfully');
  } catch (error) {
    console.error('Failed to start app:', error);
    // Don't exit - just log the error and continue
  }
});

app.on('window-all-closed', () => {
  console.log('Window closed event triggered');
  // Temporarily disable auto-quit to debug
  // if (process.platform !== 'darwin') {
  //   console.log('Quitting app');
  //   app.quit();
  // }
});

// Prevent app from crashing on unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - keep the app running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep the app running
});

// IPC: Daily note path (re-enabled for file operations)
ipcMain.handle('vault.ensureDailyNote', async (_e) => {
  try {
    const vaultRoot = path.join(app.getPath('documents'), 'NotesVault');
    console.log('🏠 Creating daily note in:', vaultRoot);
    const result = ensureDailyNote({ root: vaultRoot });
    console.log('📅 Daily note path:', result);

    // Auto-index the daily note to make it searchable
    try {
      console.log('🔄 Auto-indexing daily note for search...');
      await reindexFile(result);
      console.log('✅ Daily note indexed');
    } catch (indexError) {
      console.error('❌ Failed to index daily note:', indexError);
      // Don't throw - note creation succeeded
    }

    return result;
  } catch (error) {
    console.error('❌ Error creating daily note:', error);
    throw error;
  }
});

// IPC: Read/Write file
ipcMain.handle('fs.read', (_e, filePath: string) => {
  try {
    console.log('Reading file:', filePath);
    const result = readFileAbs(filePath);
    console.log('File content length:', result.length);
    return result;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('fs.write', async (_e, filePath: string, content: string) => {
  try {
    console.log('Writing file:', filePath);
    writeFileAbs(filePath, content);
    console.log('File written successfully');

    // Auto-reindex the file after saving
    try {
      console.log('Auto-reindexing after save...');
      await reindexFile(filePath);
      console.log('Auto-reindex completed');
    } catch (indexError) {
      console.error('Auto-reindex failed:', indexError);
      // Don't throw - file save succeeded
    }
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

// IPC: Reindex a file
ipcMain.handle('index.reindexFile', async (_e, filePath: string) => {
  try {
    console.log('Reindexing file:', filePath);
    await reindexFile(filePath);
    console.log('Reindexing completed');
    return true;
  } catch (error) {
    console.error('Error reindexing file:', error);
    throw error;
  }
});

// IPC: Search FTS
ipcMain.handle('search.blocks', (_e, query: string) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    console.log('🔍 Search query:', query);

    // Try simple LIKE search first (more reliable)
    db.all(
      `SELECT id as block_id, note_id, text_plain as text FROM blocks WHERE text_plain LIKE ? LIMIT 50`,
      [`%${query}%`],
      (err, rows) => {
        if (err) {
          console.error('❌ Search error:', err);
          reject(err);
        } else {
          console.log('🔍 Search results count:', rows?.length || 0);
          if (rows && rows.length > 0) {
            console.log('🔍 First result:', rows[0]);
          }
          resolve(rows || []);
        }
      }
    );
  });
});

// IPC: Navigate to wikilink (create if doesn't exist)
ipcMain.handle('notes.navigate', async (_e, linkTarget: string) => {
  try {
    const vaultRoot = path.join(app.getPath('documents'), 'NotesVault');

    // Sanitize filename and create path
    const sanitized = linkTarget.replace(/[<>:"/\\|?*]/g, '-'); // Replace invalid chars
    const notePath = path.join(vaultRoot, `${sanitized}.md`);

    console.log('🔗 Navigating to wikilink:', linkTarget);
    console.log('📁 Note path:', notePath);

    // Check if note exists
    if (!fs.existsSync(notePath)) {
      console.log('📝 Creating new note:', linkTarget);

      // Create new note with H1 title and empty bullet
      const content = `# ${linkTarget}\n\n- `;
      fs.writeFileSync(notePath, content, 'utf8');

      // Auto-reindex the new note
      try {
        await reindexFile(notePath);
        console.log('✅ New note indexed');
      } catch (indexError) {
        console.error('❌ Failed to index new note:', indexError);
      }
    }

    return notePath;
  } catch (error) {
    console.error('❌ Navigation failed:', error);
    throw error;
  }
});

// IPC: Get backlinks for a note (what links TO this note)
ipcMain.handle('notes.backlinks', (_e, notePath: string) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    // Extract note name from path for matching wikilinks
    const noteName = path.basename(notePath, '.md');
    console.log('🔗 Finding backlinks for:', noteName);

    const sql = `
      SELECT DISTINCT n.title, n.path, b.text_plain
      FROM links l
      JOIN blocks b ON b.id = l.src_block_id
      JOIN notes n ON n.id = b.note_id
      WHERE l.kind = 'wikilink' AND l.target = ?
      ORDER BY n.title
    `;

    db.all(sql, [noteName], (err, rows) => {
      if (err) {
        console.error('❌ Backlinks query error:', err);
        reject(err);
      } else {
        console.log('🔗 Found backlinks:', rows?.length || 0);
        resolve(rows || []);
      }
    });
  });
});

// IPC: Master tasks with filters
ipcMain.handle('tasks.master', (_e, filters = {}) => {
  return new Promise((resolve, reject) => {
    const db = getDb();

    // Build WHERE clause based on filters
    let whereConditions = [];
    let params = [];

    // Status filter: map frontend values to database values
    if (filters.status) {
      if (filters.status === 'not-done') {
        whereConditions.push('t.state IN (?, ?)');
        params.push('TODO', 'DOING');
      } else if (filters.status === 'doing') {
        whereConditions.push('t.state = ?');
        params.push('DOING');
      } else if (filters.status === 'done') {
        whereConditions.push('t.state = ?');
        params.push('DONE');
      }
    } else {
      // Default: show all tasks
      whereConditions.push('t.state IN (?, ?, ?)');
      params.push('TODO', 'DOING', 'DONE');
    }

    // Date range filter (filter by note creation/update date)
    if (filters.startDate) {
      whereConditions.push('date(n.updated_at / 1000, "unixepoch") >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereConditions.push('date(n.updated_at / 1000, "unixepoch") <= ?');
      params.push(filters.endDate);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const sql = `
      SELECT t.state, b.text_plain AS text, n.title, n.path, b.id AS block_id,
             date(n.updated_at / 1000, "unixepoch") AS note_date
      FROM tasks t
      JOIN blocks b ON b.id = t.block_id
      JOIN notes n ON n.id = b.note_id
      ${whereClause}
      ORDER BY n.updated_at DESC, b.order_in_parent
    `;

    console.log('📋 Master tasks query:', sql, 'params:', params);

    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Master tasks query failed:', err);
        reject(err);
      } else {
        console.log('📋 Found', rows.length, 'tasks');
        resolve(rows);
      }
    });
  });
});

// IPC: Update task status
ipcMain.handle('tasks.updateStatus', async (_e, blockId: string, newStatus: string) => {
  return new Promise(async (resolve, reject) => {
    const db = getDb();

    try {
      console.log('🔄 Updating task status:', blockId, 'to', newStatus);

      // First, get the task and note info
      const taskQuery = `
        SELECT t.state, b.text_md, n.path
        FROM tasks t
        JOIN blocks b ON b.id = t.block_id
        JOIN notes n ON n.id = b.note_id
        WHERE t.block_id = ?
      `;

      db.get(taskQuery, [blockId], async (err, taskRow: any) => {
        if (err) {
          console.error('❌ Failed to find task:', err);
          reject(err);
          return;
        }

        if (!taskRow) {
          reject(new Error('Task not found'));
          return;
        }

        console.log('📋 Found task:', taskRow);

        // Update the source note file - don't update DB directly, let reindex handle it
        try {
          console.log('📄 Updating source note:', taskRow.path);

          // Read the current file content
          const currentContent = await readFileAbs(taskRow.path);

          // Update the checkbox syntax in the content
          const updatedContent = updateTaskStatusInContent(currentContent, blockId, newStatus);

          // Write the updated content back to file
          writeFileAbs(taskRow.path, updatedContent);

          // Re-index the file to update the database (this will handle the task status update)
          await reindexFile(taskRow.path);

          console.log('✅ Task status updated successfully');
          resolve({ success: true });

        } catch (fileErr) {
          console.error('❌ Failed to update source note:', fileErr);
          reject(fileErr);
        }
      });

    } catch (error) {
      console.error('❌ Task update failed:', error);
      reject(error);
    }
  });
});

// Helper function to update task status in note content
function updateTaskStatusInContent(content: string, blockId: string, newStatus: string): string {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this line contains our block ID
    if (line.includes(`{id: ${blockId}}`)) {
      console.log('📋 Found line to update:', line);

      // Update the checkbox syntax based on new status
      let updatedLine = line;

      if (newStatus === 'TODO') {
        // Convert to TODO: [ ]
        updatedLine = line.replace(/^(\s*-\s+)\[.\](\s+\(Doing\))?\s*/, '$1[ ] ');
      } else if (newStatus === 'DOING') {
        // Convert to DOING: [ ] (Doing)
        updatedLine = line.replace(/^(\s*-\s+)\[.\](\s+\(Doing\))?\s*/, '$1[ ] (Doing) ');
      } else if (newStatus === 'DONE') {
        // Convert to DONE: [x]
        updatedLine = line.replace(/^(\s*-\s+)\[.\](\s+\(Doing\))?\s*/, '$1[x] ');
      }

      console.log('📋 Updated line:', updatedLine);
      lines[i] = updatedLine;
      break;
    }
  }

  return lines.join('\n');
}