PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notes (
  id            TEXT PRIMARY KEY,
  path          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  id               TEXT PRIMARY KEY,
  note_id          TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  parent_block_id  TEXT REFERENCES blocks(id) ON DELETE CASCADE,
  order_in_parent  INTEGER NOT NULL,
  depth            INTEGER NOT NULL,
  text_md          TEXT NOT NULL,
  text_plain       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  src_block_id  TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  target        TEXT NOT NULL,
  kind          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id   TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  tag_text   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id   TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  state      TEXT NOT NULL,
  due        TEXT,
  priority   TEXT
);

-- Full-text search over blocks
CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
  block_id UNINDEXED,
  note_id UNINDEXED,
  text,
  content='',
  tokenize='porter'
);

CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_block_id);
CREATE INDEX IF NOT EXISTS idx_links_src ON links(src_block_id);
CREATE INDEX IF NOT EXISTS idx_tags_block ON tags(block_id);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON tasks(state);