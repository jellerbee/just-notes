# Append‑Only Outline Editor Spec (Desktop + Cloud)

**Goal:** Personal, bullets‑only outliner where **committed bullets are immutable**. You only ever *append* new bullets (siblings or children). No edits, no deletes, no moves. Future AI services read your raw notes and attach non‑destructive annotations (tasks, links, entities). Cloud API is simple, cheap, and robust without realtime.

---

## 0) Principles

- **Bullets‑only**: The only content unit is a bullet item with optional children.
- **Append‑only**: After you press Enter (commit), that bullet’s text never changes.
- **No Markdown typing**: Editor shows bullets natively; exports are convenience only.
- **Read‑optimized**: DB keeps a materialized view for search/backlinks; writes are append events.
- **Multi‑client friendly**: Phone STT, OCR, etc. all just append.
- **Recoverable**: If you mis‑type, you append a correction; for privacy, you can append a **redact** event that hides a prior bullet (soft delete) without mutating history.

---

## 1) High‑Level Architecture

- **Desktop editor:** React + Tiptap (bullets‑only schema). Local staging text input → Commit appends to server.
- **Server API (REST):** Append operations only (bullets, annotations, redactions). No PUT/DELETE.
- **Storage:** Postgres (managed) with an **append log** + **materialized tables**. Optional object storage for daily snapshots/exports.
- **Indexer:** On‑commit trigger (or worker) updates `bullets`, `fts`, and `links` tables from each append.
- **No WebSockets required.** Realtime can be added later if ever needed.

---

## 2) Data Model

### 2.1 Identity

- `note_id` (UUID) per **daily note** (keyed by `date`), created on first append.
- `bullet_id` (UUID) per bullet, generated client‑side at commit.

### 2.2 Append log (source of truth)

```
appends (
  seq           BIGSERIAL PRIMARY KEY,   -- global or per-note (see below)
  note_id       UUID NOT NULL,
  kind          TEXT NOT NULL,           -- 'bullet' | 'annotation' | 'redact'
  payload       JSONB NOT NULL,          -- schema per kind (below)
  created_at    timestamptz NOT NULL DEFAULT now()
)
-- Optional: per-note sequence if you prefer monotonic ordering per day
-- Create UNIQUE(note_id, seq_note) where seq_note is nextval per note.
```

**Payloads**

- `bullet`:
  ```json
  {
    "bulletId": "uuid",
    "parentId": "uuid or null",
    "depth": 0,
    "text": "raw text",
    "spans": [ {"type":"wikilink|url|tag|mention", "start":int, "end":int, "payload":{}} ]
  }
  ```
- `annotation` (from AI or user):
  ```json
  {
    "bulletId": "uuid",
    "type": "task|entity|link|label|pin",
    "data": { "state":"open|done|doing", "target":"LifeTrail", ... }
  }
  ```
- `redact` (soft delete/hide):
  ```json
  { "bulletId": "uuid", "reason": "mistyped secret" }
  ```

### 2.3 Materialized read model (derived)

```
notes (
  id            UUID PK,
  date          DATE UNIQUE,
  created_at    timestamptz,
  updated_at    timestamptz,
  last_seq      BIGINT               -- high-watermark applied to this note
)

bullets (
  id              UUID PK,
  note_id         UUID REFERENCES notes(id) ON DELETE CASCADE,
  parent_id       UUID NULL REFERENCES bullets(id) ON DELETE CASCADE,
  depth           INT NOT NULL,
  order_seq       BIGINT NOT NULL,   -- append order within note
  text            TEXT NOT NULL,
  redacted        BOOLEAN NOT NULL DEFAULT FALSE
)

annotations (
  id              BIGSERIAL PK,
  bullet_id       UUID REFERENCES bullets(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,     -- task|entity|link|label|pin
  data            JSONB NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
)

links (
  id              BIGSERIAL PK,
  bullet_id       UUID REFERENCES bullets(id) ON DELETE CASCADE,
  target_type     TEXT NOT NULL,     -- 'note'|'entity'|'url'
  target_value    TEXT NOT NULL
)

-- Full-text search
ALTER TABLE bullets ADD COLUMN text_tsv tsvector;
CREATE INDEX idx_bullets_fts ON bullets USING GIN (text_tsv) WHERE redacted = false;
CREATE INDEX idx_bullets_note ON bullets(note_id);
CREATE INDEX idx_bullets_parent ON bullets(parent_id);
CREATE INDEX idx_links_bullet ON links(bullet_id);
```

**FTS trigger**: on insert of new bullet or redaction flip, set `text_tsv := to_tsvector('english', text)`.

**Backlinks**: populate `links` from `spans` where `type='wikilink'`.

---

## 3) API (Append‑only)

### 3.1 Notes

- `POST /notes/{date}:ensure` → `{ note_id, last_seq }` (creates note if missing)
- `GET /notes/{note_id}?sinceSeq=...` → returns bullets (non‑redacted) with `order_seq > sinceSeq`, plus `last_seq`

### 3.2 Bullets

- `POST /notes/{note_id}/bullets:append`

  ```json
  {
    "clientSeq": 17,                // optional idempotency key per client
    "bulletId": "uuid",           // client-generated
    "parentId": "uuid or null",
    "depth": 0,
    "text": "…",
    "spans": [ ... ]
  }
  ```

  **Response:** `{ orderSeq, lastSeq }`

- `POST /notes/{note_id}/bullets:appendBatch` → array of above

### 3.3 Annotations (AI or user)

- `POST /annotations:append` with `{ bulletId, type, data }`

### 3.4 Redaction

- `POST /redact` with `{ bulletId, reason }` → marks bullet as `redacted=true` in read model; keeps history in log.

### 3.5 Search / Backlinks

- `GET /search?q=...` → FTS over non‑redacted bullets; returns `{ bulletId, noteId, date, text, depth, parentId }`
- `GET /backlinks?target=LifeTrail` → rows from `links` joined to `bullets`

**Auth:** Bearer JWT. Optional per‑device key for STT/OCR apps.

**Idempotency:** `clientSeq` stored in a small `idempotency` table keyed by (client\_id, clientSeq) → dedupe retries.

---

## 4) Desktop Editor (Bullets‑only, Append‑only)

### 4.1 UX

- Opening a daily note auto‑focuses an **empty top‑level bullet composer** (a single text input).
- **Enter** commits the current bullet → POST append → clears composer and creates a new bullet composer at same level.
- **Tab** turns the composer into a child of the previous committed bullet (increments `depth`, sets `parentId`).
- **Shift+Tab** reduces `depth` (cannot outdent beyond root; if depth becomes invalid, keep at root).
- **Backspace in empty composer**:
  - If depth > 0 → outdent (depth‑1)
  - If depth = 0 → no‑op (or flash)
- **Wikilinks**: typing `[[` opens suggestions; committing inserts link span into the composer text (no Markdown needed in storage; spans recorded on commit).
- **Tags**: `#` autocomplete; stored as `spans`.
- **No edits to committed bullets**: Clicking a committed bullet selects it for **reply/child** not edit. If user tries to edit, show tooltip “Bullets are immutable — append a correction below.”
- **Collapse/expand**: purely a view preference per client (stored locally or as a user setting in DB). Does not mutate bullets.

### 4.2 Ordering

- Sibling order is strictly **append order**. There’s no move/reorder in append‑only mode. `order_seq` = the append log `seq` (or per‑note seq).

### 4.3 Error handling

- If append fails, keep the composer text and show a retry banner. Use `clientSeq` for idempotent retry.

---

## 5) AI & Automation (Non‑destructive)

- AI services consume `GET /notes/{note_id}` or stream from `appends`.
- Create annotations via `POST /annotations:append` (e.g., `{type:'task', data:{state:'open', due:'2025-10-15'}}`).
- Tasks view is a query over `annotations` joined to `bullets`.
- Entity pages (your “proper nouns index”) are queries over `annotations(type='entity')` and `links`.

---

## 6) Import from File‑based MVP

- For each daily file:
  - Walk bullets in visual order; generate `bulletId` per line (reuse your existing IDs if present).
  - Append bullets to `/notes/{note_id}/bullets:append` in that order, preserving `parentId` and `depth`.
  - Extract `[[...]]` and `#tags` into `spans`.
- Result: Cloud state matches your local day structure; committed and immutable thereafter.

---

## 7) Deployment & Ops

This project will be deployed on **Render.com** using a Render Blueprint (`render.yaml`). It will consist of:

- **Frontend**: React/Tiptap desktop web app, built and served as a static site on Render.
- **Backend API**: Node/Express or FastAPI service that implements the append‑only REST API.
- **Database**: Existing managed PostgreSQL instance (already provisioned in Render). The backend connects to it via `DATABASE_URL`.
- **Indexing**: Done inline in the backend for MVP (parsing spans, updating FTS). Can be moved to a separate worker service later if load grows.
- **Backups**: Use Render’s PostgreSQL backup schedule. Optional: daily JSON export to S3 for redundancy.

### Starter `render.yaml`
```yaml
services:
  - type: web
    name: notes-frontend
    env: static
    buildCommand: npm install && npm run build
    staticPublishPath: build
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

  - type: web
    name: notes-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    plan: starter
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: notes-db
          property: connectionString

  # Database already exists, but if you want it in the blueprint:
  - type: pserv
    name: notes-db
    env: postgres
    plan: starter
    disk:
      name: data
      mountPath: /var/lib/postgresql/data
      sizeGB: 10
```

### Deployment flow
1. Commit code to GitHub.
2. Connect repo to Render.
3. Deploy via `render.yaml` blueprint.
4. Backend automatically connects to the existing Postgres database.
5. Verify migrations applied (SQL/Prisma).
6. Frontend served on its own Render URL.

---

## 8) Acceptance Criteria

1. Desktop composer enforces append‑only: committed bullets are non‑editable; you can only append siblings/children.
2. Enter/Tab/Shift+Tab behaviors work as specified; depth and parent are correct on commit.
3. Append API is idempotent; retrying does not duplicate bullets.
4. Search returns matches across days in <200ms on 100k bullets; results exclude redacted bullets.
5. Backlinks surface bullets containing `[[Target]]` spans correctly.
6. Redaction appends hide bullets from all default reads but retain history in `appends`.
7. Importer migrates local files → cloud with preserved structure/IDs.

---

## 9) Future Extensions

- **Per‑bullet attachments**: add `attachments` table keyed by `bullet_id` (e.g., images, audio clips) on append.
- **Semantic search**: embeddings of `bullets.text` into `pgvector` or external vector DB.
- **Streams**: server‑sent events (SSE) to notify clients of new appends (still not full realtime editing).
- **Per‑device UI state**: store collapse/expanded nodes per note for each device/user.
- **Retention**: optional compaction that emits a materialized snapshot of a day and archives old appends (since bullets are immutable, this is trivial).

---

## 10) Minimal SQL (append → read model)

```sql
-- On bullet append
WITH ins AS (
  INSERT INTO appends(note_id, kind, payload)
  VALUES ($1, 'bullet', $2::jsonb)
  RETURNING seq, note_id, (payload->>'bulletId')::uuid AS bid, payload
)
INSERT INTO bullets(id, note_id, parent_id, depth, order_seq, text)
SELECT bid,
       note_id,
       NULLIF(payload->>'parentId','')::uuid,
       (payload->>'depth')::int,
       seq,
       payload->>'text'
FROM ins;

-- FTS update
UPDATE bullets SET text_tsv = to_tsvector('english', text) WHERE id = (SELECT bid FROM ins);

-- Links from spans
INSERT INTO links(bullet_id, target_type, target_value)
SELECT (payload->>'bulletId')::uuid,
       s->>'type',
       COALESCE((s->'payload'->>'target'), substring(text from (s->>'start')::int + 1 for (s->>'end')::int - (s->>'start')::int))
FROM ins,
LATERAL jsonb_array_elements(payload->'spans') s
WHERE s->>'type' IN ('wikilink','url','tag');
```

---

## 11) Editor Implementation Notes

- Keep a **single active composer** (text input) at a time. Committed bullets render as read‑only items.
- The composer maintains transient `depth`/`parentId` from context (previous committed bullet and Tab/Shift+Tab actions).
- On commit success, append the new read‑only item to the DOM list and create a fresh composer below it (same depth).
- For adding a **child quickly**: shortcut `Cmd/Ctrl+]` to create child composer under the last committed bullet.
- For **sibling at parent level**: `Cmd/Ctrl+[` lifts composer one level before commit.

---

**Summary:** This design fits your “raw, immutable notes” philosophy perfectly: bullets are atomic facts captured in time, everything else (tasks, entities, corrections, privacy) happens as *append‑only* metadata. It’s simple to build, easy to reason about, and ready for additional clients without the complexity of realtime CRDTs.

