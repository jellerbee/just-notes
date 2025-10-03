# jnotes engineering spec

# 1) MVP Goal & Scope

**Goal:** Local desktop app (Tauri or Electron + React) that saves notes as Markdown files, maintains a fast SQLite index for search/links/tasks, and gives you an outliner editor.

NOTE: this spec is for the MVP just to validate the concept.  Production MVP spec is: jnotes_V1.1_mods.md. Implementation plan is: jnotes_V1.1_plan.txt

**In scope (MVP):**

- Daily page auto-creation (`YYYY-MM-DD.md`)
- Outliner editor with bullets/indent/outdent, `[[wikilinks]]`, `#tags`, inline `TODO` tasks
- Files on disk (Markdown) as source of truth
- Background indexer → SQLite (FTS5) for search, backlinks, task rollup
- Global search and a “Master Tasks” view
- Export = your files already on disk (plus DB file)

**Out of scope (MVP):**

- Multi-device sync/CRDT
- Collaboration, permissions, sharing
- Mobile apps (use PWA later if desired)
- AI helpers (can be a Phase 2)

---

# 2) Tech Stack (recommended)

- **Shell:** Tauri + React (Vite) — fast desktop, native file access
- **Editor:** Tiptap (ProseMirror) for rich outliner UX
- **Storage:**
    - Markdown files in a local “vault” folder
    - SQLite w/ **FTS5** (bundled with Tauri) for index
- **Langs:** TypeScript (frontend), Rust (Tauri commands) or Node bindings if you choose Electron
- **UUIDs:** `uuidv4()` for notes & blocks

---

# 3) Data Model

### 3.1 Files on disk (truth)

- Directory: `~/NotesVault/`
- Daily notes: `YYYY-MM-DD.md`
- Other notes: `Title.md` (slugified unique filename)
- Encoding: UTF-8 LF
- Line endings: Unix
- Frontmatter (optional MVP): keep minimal; we’ll pull most structure from the text

**Markdown conventions (MVP):**

- **Blocks:** Lines starting with  are list items; indentation via 2 spaces per level
- **Tasks:** `TODO text` | `DOING text` | `DONE text`
- **Wikilinks:** `[[Entity or Note Title]]`
- **Tags:** `#TagLikeThis`
- **Headers:** optional; not required for MVP logic

### 3.2 SQLite schema (index/caches)

**Tables**

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Notes (one row per markdown file)
CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,      -- uuidv4
  path          TEXT NOT NULL UNIQUE,  -- absolute file path
  title         TEXT NOT NULL,         -- derived from file name or first header
  created_at    INTEGER NOT NULL,      -- epoch ms (from fs or parsed)
  updated_at    INTEGER NOT NULL       -- epoch ms (from fs)
);

-- Blocks (one row per bullet or paragraph we treat as a block)
CREATE TABLE IF NOT EXISTS blocks (
  id               TEXT PRIMARY KEY,        -- uuidv4 stable per block (store in hidden md id annotation)
  note_id          TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  parent_block_id  TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  order_in_parent  INTEGER NOT NULL,        -- 0..N among siblings
  depth            INTEGER NOT NULL,        -- 0 = top-level bullet
  text_md          TEXT NOT NULL,           -- exact markdown for the block line (without child lines)
  text_plain       TEXT NOT NULL            -- normalized plain text (for FTS & queries)
);

-- Links (wikilinks + urls)
CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  src_block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  target      TEXT NOT NULL,            -- for [[wikilinks]] the target title string; for urls store url
  kind        TEXT NOT NULL             -- 'wikilink' | 'url'
);

-- Tags (#Tag)
CREATE TABLE IF NOT EXISTS tags (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id     TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  tag_text     TEXT NOT NULL            -- canonicalized (e.g., case-insensitive)
);

-- Tasks (inline states)
CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id     TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  state        TEXT NOT NULL,           -- 'TODO' | 'DOING' | 'DONE'
  due          TEXT,                    -- ISO date string if parsed (optional)
  priority     TEXT                     -- 'A'|'B'|'C' etc. (optional MVP)
);

-- Backlinks materialized view (optional optimization in MVP)
-- For now, compute backlinks at query time by joining links.target to note titles.

-- Full-text search (FTS5) over blocks
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
  block_id UNINDEXED,
  note_id UNINDEXED,
  text,
  content='',
  tokenize = 'porter'
);

-- Convenience indices
CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_block_id);
CREATE INDEX IF NOT EXISTS idx_tags_block ON tags(block_id);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);

```

**FTS maintenance**

```sql
-- On (re)index:
-- 1) DELETE FROM blocks_fts;
-- 2) INSERT INTO blocks_fts (block_id, note_id, text)
--    SELECT id, note_id, text_plain FROM blocks;

```

---

# 4) Indexer (Markdown → DB) — deterministic pipeline

**Trigger:** file save / vault scan / manual “Reindex” button.

**Steps (per file):**

1. **Read file** + stat times.
2. **Parse into block tree** (indent = depth;  bullet lines become blocks).
3. **Assign/restore block IDs**
    - If a line already has a hidden ID marker (`<!-- {id:uuid} -->`) keep it.
    - Else generate `uuidv4()` and append hidden marker to the end of the line on disk (so IDs are stable across reindex).
4. **Extract:**
    - `text_md` = full bullet line markdown (sans children)
    - `text_plain` = stripped text (remove `TODO`, links markup, etc.)
    - `[[wikilinks]]` → add to `links(kind='wikilink', target='inner text')`
    - `http(s)://...` → `links(kind='url')`
    - `#Tags` → `tags(tag_text='Tag')`
    - `TODO/DOING/DONE` at the start of line → `tasks(state=...)`
5. **Upsert DB:**
    - Upsert `notes` by `path`
    - For each block:
        - Upsert by `id`
        - Set `note_id`, `parent_block_id`, `order_in_parent`, `depth`, `text_md`, `text_plain`
    - Replace `links`, `tags`, `tasks` for the block (delete old then insert new in a transaction)
6. **Update FTS** for changed blocks (or rebuild on small MVP).
7. **Commit** transaction.

**Hidden ID annotation format in Markdown (MVP):**

```markdown
- TODO Call John <!-- {id: 6f4b6a8a-2e86-4b09-9c16-3c7c1b8e3d4a} -->

```

(IDs are invisible in preview; keep exactly one per block line.)

---

# 5) Editor: Tiptap Config (Outliner)

**Features (MVP):**

- Bulleted list / list item
- Indent/outdent via Tab / Shift+Tab
- Toggle task states with shortcut (e.g., Cmd/Ctrl+Enter cycles TODO→DOING→DONE)
- Wikilinks `[[...]]` with suggestion dropdown (search note titles)
- Hashtag autocompletion (optional)
- Paste plain text → converted to bullets by line
- Keyboard-centric (Enter = new sibling, Shift+Enter = soft break)

**Packages:**

- `@tiptap/react`, `@tiptap/starter-kit`
- List-related extensions
- Custom extension for `wikilink`
- Custom extension for `taskState` mark or node attribute
- Keymap customization

**Minimal Tiptap setup (TypeScript):**

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'

// Custom extensions you'll add:
// - BulletList / ListItem configs (from StarterKit)
// - Wikilink (see below)
// - TaskState (inline mark or node attribute)
// - HardBreak if desired

export function NoteEditor({ initialContent, onUpdate }: { initialContent: string; onUpdate: (md: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: true,
        },
      }),
      Link.configure({
        autolink: true,
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Type - to start a bullet, [[ to link a note, #tag…',
      }),
      // Wikilink,
      // TaskState,
    ],
    content: initialContent, // Provide Markdown converted to ProseMirror JSON/HTML via your md<->pm bridge
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      // Convert ProseMirror doc → Markdown (your serializer)
      const md = serializePMToMarkdown(editor.getJSON())
      onUpdate(md)
    },
    editorProps: {
      handleKeyDown(view, event) {
        // Tab / Shift+Tab for indent/outdent in lists
        if (event.key === 'Tab') {
          const isShift = event.shiftKey
          event.preventDefault()
          if (isShift) {
            // outdent
            return outdentListItem(view)
          } else {
            // indent
            return indentListItem(view)
          }
        }
        // Cmd/Ctrl+Enter → cycle task state
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          cycleTaskState(view)
          return true
        }
        return false
      },
    },
  })

  return <EditorContent editor={editor} className="editor" />
}

```

**Wikilink extension sketch:**

```tsx
import { Node, mergeAttributes } from '@tiptap/core'

export const Wikilink = Node.create({
  name: 'wikilink',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes() {
    return { target: { default: '' } }
  },
  parseHTML() { return [{ tag: 'span[data-wikilink]' }] },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-wikilink': 'true' }), `[[${HTMLAttributes.target}]]`]
  },
})
// You’ll also implement input rules so typing `[[` opens suggestions and inserts a wikilink node.

```

**Task state handling (plain Markdown for MVP):**

- Tiptap displays a bullet. When user triggers cycle:
    - If line starts with `TODO`  → replace with `DOING`
    - If `DOING`  → `DONE`
    - Else insert `TODO`  prefix
- Keep it purely text-level in MVP; no checkbox UI required (you can add later).

---

# 6) App Flows

### 6.1 Daily Note

- On app open (or CMD+D): ensure `YYYY-MM-DD.md` exists; open it
- Cursor at first bullet
- First save triggers indexer

### 6.2 Create Note

- CMD+N → prompt title → create `Title.md` with an H1 or first bullet
- Open in editor; save triggers indexer

### 6.3 Search

- Global search input (`/`):
    - `SELECT block_id, note_id FROM blocks_fts WHERE blocks_fts MATCH ? LIMIT 50`
    - Show snippets (pull from `blocks.text_plain`)
    - Clicking result opens note and scrolls to block

### 6.4 Backlinks

- For a given note title `T`, backlinks = all blocks with `links.kind='wikilink' AND target='T'`
    
    ```sql
    SELECT b.* FROM links l
    JOIN blocks b ON b.id = l.src_block_id
    WHERE l.kind='wikilink' AND l.target = :title
    ORDER BY b.note_id, b.order_in_parent;
    
    ```
    

### 6.5 Master Tasks

```sql
SELECT t.state, b.text_plain, n.title, n.path
FROM tasks t
JOIN blocks b ON b.id = t.block_id
JOIN notes n ON n.id = b.note_id
WHERE t.state IN ('TODO','DOING')
ORDER BY t.state, n.updated_at DESC;

```

---

# 7) Directory & File Layout

```
app/
  src/
    main/                    # Tauri/Electron main
      index.ts
      fs.ts                  # read/write files, vault watcher
      db.ts                  # sqlite connection, migrations
      indexer.ts             # markdown -> DB pipeline
    renderer/
      components/
        NoteEditor.tsx
        Search.tsx
        TasksView.tsx
      lib/
        markdown/
          parse.ts           # md -> block tree (+ extract links/tags/tasks)
          serialize.ts       # pm -> md, md -> pm
        tiptap/
          wikilink.ts
          keymaps.ts
          tasks.ts
      pages/
        Daily.tsx
        Note.tsx
        Home.tsx
    shared/
      types.ts               # Block, Note, Link, Tag types
      uuid.ts
  sqlite/
    schema.sql               # (from above)
  package.json
  tauri.conf.json

```

---

# 8) Markdown Parsing Rules (deterministic)

- **Indent = 2 spaces** per depth level (tabs normalize to 2 spaces)
- **Block line regex (bullet):** `/^(\s*)-\s+(.*)$/`
    - `depth = indentLen / 2`
    - `text_md = original line content`
    - `text_plain = stripTaskPrefix(stripMdFormatting(...))`
- **Task prefix:** `^(TODO|DOING|DONE)\s+`
- **Wikilink regex:** `/\[\[([^\]]+)\]\]/g` → `links(kind='wikilink', target=capture)`
- **Tag regex:** `/(^|\s)#([A-Za-z0-9\-_]+)/g` → `tags(tag_text=capture)`
- **URL regex:** `/https?:\/\/\S+/g`
- **Hidden ID marker:** `<!-- {id: <uuid>} -->` (required per block; add if missing)
- **Order within parent:** incremental by appearance

---

# 9) Migrations & Reindex

- On app start, run `schema.sql`
- Provide a “Reindex All” command:
    - Delete all rows from `blocks`, `links`, `tags`, `tasks`, `blocks_fts`
    - Re-scan vault, parse, upsert, rebuild FTS

---

# 10) UX Details (MVP)

- **Keybindings**
    - Enter: new sibling bullet
    - Shift+Enter: soft break
    - Tab / Shift+Tab: indent/outdent list item
    - Cmd/Ctrl+Enter: cycle task state
    - `[[`: open quick switcher for titles; Enter inserts wikilink
    - `/`: focus global search
    - Cmd/Ctrl+K: quick open by title
- **Panels**
    - Left: “Today”, “All Notes”, “Tasks”
    - Main: Editor + Backlinks pane (below or side)
    - Right (optional): Note outline (top-level blocks)

---

# 11) Acceptance Criteria

1. **Daily note** auto-creates/open; saving creates a file and index entries.
2. **Outliner**: indent/outdent + bullets work; task cycling edits text prefix correctly.
3. **Wikilinks**: inserting `[[Some Note]]` creates a link; clicking opens/creates `Some Note.md`.
4. **Search**: typing a term returns results in <100ms on 5k blocks; clicking jumps to block.
5. **Tasks view**: shows all TODO/DOING across files with note context.
6. **Backlinks**: opening a note shows all blocks that link to it.
7. **Stability**: quit/reopen app → IDs are preserved; reindex doesn’t duplicate blocks.
8. **Data portability**: all notes readable as Markdown in any editor; DB can be deleted and rebuilt.

---

# 12) Phase 2 Hooks (not for MVP, but design-compatible)

- AI: proper-noun detection → auto `[[Entities]]`; daily digest
- Due dates: parse `(due: YYYY-MM-DD)` inline into `tasks.due`
- Priority: `(P1|P2|P3)` → `tasks.priority`
- Embeddings: `pgvector/sqlite-vss` for semantic search later
- CRDT/Yjs for future multi-device sync

---

# 13) Test Fixtures

Create `fixtures/` with:

```
2025-09-28.md
  - TODO Call [[John Ferguson]] about Veza <!-- {id: ...} -->
    - Mention reference timeline #Hiring
  - Idea: Proper noun index from [[LifeTrail]] notes <!-- {id: ...} -->
  - DONE Draft blog outline #Writing <!-- {id: ...} -->

LifeTrail.md
  - Project goals
  - Links: https://example.com/lt <!-- {id: ...} -->

```

Expected:

- 1 note per file, blocks created with correct depth/order, links/tags/tasks populated
- Search “Veza” finds first block
- Backlinks for `LifeTrail` shows the idea block from Daily

---

If you want, I can also generate **starter code stubs** (parse/serialize, Tiptap extensions, DB init) so your copilot can fill in the rest with fewer ambiguities.