Phased Migration Plan

  Phase 0: Local Append-Only Prototype (1-2 days)

  Goal: Validate append-only UX before building cloud infrastructure

  Why first: Test the biggest UX change (immutable bullets) with minimal investment.

  1. Modify simple.html editor:
    - Disable editing of committed bullets
    - Add "composer mode" for new bullets only
    - Implement Enter → commit → new composer flow
    - Show tooltip on edit attempt: "Bullets are immutable"
  2. Add append log to SQLite:
  CREATE TABLE appends (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL,
    kind TEXT NOT NULL,  -- 'bullet'|'redact'
    payload TEXT NOT NULL,  -- JSON
    created_at INTEGER NOT NULL
  );
  3. Test workflow:
    - Can you live with append-only for 2-3 days?
    - Is the composer UX natural?
    - Do you miss editing/moving bullets?

  Decision point: If append-only feels wrong, iterate before building cloud.

  Acceptance: Working append-only editor locally; comfortable with immutability paradigm.

  ---
  Phase 1: Backend API Foundation (3-5 days)

  Goal: Build REST API with append-only Postgres schema

  1. Set up backend project:
    - Node/Express or FastAPI (your choice)
    - TypeScript recommended for shared types with frontend
    - Prisma or Drizzle ORM for type-safe DB access
  2. Postgres schema migration:
    - Implement append log tables from spec (Section 2.2-2.3)
    - Add FTS via tsvector and GIN indexes
    - Create materialized tables: notes, bullets, annotations, links
  3. Core API endpoints:
    - POST /notes/{date}:ensure - create daily note if missing
    - POST /notes/{note_id}/bullets:append - append single bullet
    - GET /notes/{note_id}?sinceSeq=X - fetch bullets since sequence
    - POST /redact - soft delete bullets
  4. Indexer logic:
    - Parse spans from bullet text (wikilinks, tags, URLs)
    - Update FTS text_tsv on insert
    - Populate links table from spans
    - Transaction handling for consistency
  5. Testing:
    - Unit tests for append idempotency
    - Test concurrent appends
    - Verify FTS indexing

  Acceptance: API can append bullets, query by note, search FTS, handle redactions.

  ---
  Phase 2: Web Frontend (Bullets-Only Editor) (4-6 days)

  Goal: React/Tiptap editor enforcing append-only UX

  1. React app setup:
    - Vite + React + TypeScript
    - TanStack Query for API state management
    - Tailwind CSS for styling (optional)
  2. Tiptap configuration:
    - Bullets-only schema (no paragraphs, no headers)
    - BulletList/ListItem only
    - Custom node for wikilinks (Section 4.1)
    - Custom node for tags
  3. Composer UX:
    - Single active text input ("composer")
    - Enter → commit → POST to API → clear → new composer
    - Tab/Shift+Tab adjust depth and parentId context
    - Backspace in empty composer → outdent
    - Committed bullets render as read-only (no contenteditable)
  4. Wikilink suggestions:
    - [[ triggers autocomplete dropdown
    - Search note titles via API
    - Insert wikilink span on selection
  5. Error handling:
    - Retry banner if append fails
    - Optimistic UI with rollback
    - clientSeq for idempotency

  Acceptance: Can append bullets, adjust depth, insert wikilinks, with committed bullets locked.

  ---
  Phase 3: Search, Backlinks, Tasks (2-3 days)

  Goal: Complete read-only views leveraging materialized tables

  1. Search UI:
    - Global search input (/ hotkey)
    - GET /search?q=term using Postgres FTS
    - Display results with context snippets
    - Click → navigate to note and scroll to bullet
  2. Backlinks panel:
    - GET /backlinks?target=NoteName
    - Show bullets referencing current note
    - Group by source note with dates
  3. Master Tasks view:
    - Query annotations where type='task'
    - Filter by state (TODO/DOING/DONE)
    - Keyboard navigation (reuse existing tasks.html patterns)
    - Click task → navigate to source bullet
  4. Annotations API:
    - POST /annotations:append for AI/user task markup
    - Frontend UI for manually marking tasks
    - Task state cycling via keyboard (Space/Enter)

  Acceptance: Search <200ms on 10k bullets, backlinks work, tasks view functional.

  ---
  Phase 4: Data Migration & Import (2-3 days)

  Goal: Migrate existing local Markdown files to cloud

  1. Migration script:
    - Read all YYYY-MM-DD.md files from ~/Documents/NotesVault/
    - Parse bullets preserving existing UUIDs
    - Preserve depth, parentId, order
    - Extract wikilinks/tags into spans
  2. Batch append API:
    - POST /notes/{note_id}/bullets:appendBatch for bulk import
    - Maintain append order via order_seq
    - Dedupe by existing bullet IDs
  3. Validation:
    - Compare SQLite vs Postgres counts
    - Verify all wikilinks preserved
    - Check backlinks consistency
    - Ensure task states migrated

  Acceptance: All local notes imported; web app shows identical structure; backlinks match.

  ---
  Phase 5: Render.com Deployment (2-3 days)

  Goal: Production deployment with managed Postgres

  1. Render Blueprint (render.yaml):
    - Static site for frontend (Vite build)
    - Web service for backend (Node/Express)
    - Connect to existing managed Postgres
  2. Environment setup:
    - DATABASE_URL from Render Postgres
    - JWT secrets for auth
    - CORS configuration
  3. CI/CD:
    - GitHub Actions or Render auto-deploy
    - Run migrations on deploy
    - Health check endpoints
  4. Auth implementation:
    - JWT-based authentication
    - Login/signup flow (or use Clerk/Auth0)
    - Per-device tokens for future STT/OCR
  5. Production testing:
    - Load testing with 100k bullets
    - FTS performance benchmarks
    - Concurrent append testing

  Acceptance: App live on Render; can append from browser; search <200ms; data persisted.

  ---
  Phase 6: Polish & Hardening (3-5 days)

  Goal: Production-ready stability and UX

  1. Redaction UX:
    - Context menu on bullet → "Redact"
    - Confirmation dialog with reason field
    - Redacted bullets show placeholder: "Redacted (reason)"
    - Admin view to see redaction history
  2. Offline support:
    - Service worker for offline writes
    - Queue appends when offline
    - Sync on reconnect
  3. Error recovery:
    - Handle network failures gracefully
    - Show sync status indicator
    - Retry with exponential backoff
  4. UX refinements:
    - Collapse/expand bullet children
    - Keyboard shortcuts help (Cmd+?)
    - Loading states and skeletons
    - Dark mode
  5. Performance:
    - Virtual scrolling for large days
    - Lazy load older notes
    - Optimize FTS queries

  Acceptance: App feels production-ready; handles edge cases; smooth offline→online flow.

  ---
  Recommended Priority & Timeline

  Must-Do (Core Append-Only Architecture):
  - Phase 0 (Local prototype): 1-2 days
  - Phase 1 (Backend API): 3-5 days
  - Phase 2 (Web editor): 4-6 days
  - Phase 3 (Search/backlinks): 2-3 days
  - Subtotal: ~2-3 weeks

  Migration & Deployment:
  - Phase 4 (Import): 2-3 days
  - Phase 5 (Render deploy): 2-3 days
  - Subtotal: ~1 week

  Polish (Ongoing):
  - Phase 6 (Hardening): 3-5 days, then iterate

  Total Estimate: 4-5 weeks to production

  ---
  Key Architectural Decisions to Make Now

  1. Backend language/framework:
    - Node/Express (same language as frontend)
    - FastAPI (Python, if you prefer)
    - Recommendation: Node + Express + Prisma for type sharing
  2. Auth strategy:
    - Roll your own JWT
    - Use managed auth (Clerk, Auth0, Supabase Auth)
    - Recommendation: Supabase Auth or Clerk for speed
  3. Real-time updates:
    - Poll for new bullets (simple)
    - Server-Sent Events (SSE)
    - WebSockets (overkill for append-only)
    - Recommendation: Start with polling, add SSE in Phase 6
  4. FTS approach:
    - Native Postgres tsvector + GIN (spec recommends this)
    - External service (Algolia, Typesense)
    - Recommendation: Postgres FTS (simpler, cheaper)

  ---
  Breaking Changes from Current MVP

  Major UX shifts:
  1. No editing committed bullets - biggest change for users
  2. No reordering bullets - append order is permanent
  3. Soft delete only - redactions instead of deletes
  4. Web app vs desktop - browser-based, not Electron

  Migration path:
  - Keep Electron app working during transition
  - Import all data to cloud (Phase 4)
  - Use web app as primary, fall back to Electron if needed
  - Eventually deprecate Electron once confident
