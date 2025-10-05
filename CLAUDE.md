# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **append-only outliner** web application built with React (frontend) + Node/Express (backend) + Postgres (database). It implements a bullets-only note-taking system where committed bullets are immutable - you can only append new content, never edit or delete existing bullets. The system automatically creates daily notes and supports wikilinks, tags, search, backlinks, and task management.

**Key Philosophy:** Bullets are atomic facts captured in time. Everything else (tasks, entities, corrections, privacy) happens as append-only metadata.

## Architecture

**Frontend** (`/frontend/`):
- **Framework:** React + Vite + TypeScript
- **Editor:** Tiptap (bullets-only schema)
- **State:** TanStack Query for API state management
- **Features:**
  - Append-only bullet editor with visual indenting
  - Wikilink autocomplete (`[[` trigger)
  - Tag autocomplete (`#` trigger)
  - Global search (Cmd+K)
  - Backlinks panel (Cmd+B)
  - Master tasks view (Ctrl+T)

**Backend** (`/backend/`):
- **Framework:** Node + Express + TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL (managed on Render.com)
- **Architecture:** Append log + materialized tables
- **Key Services:**
  - REST API endpoints (append-only operations)
  - Indexer service (spans parsing, FTS updates, link extraction)
  - Idempotency tracking via clientSeq

**Data Model:**
- **Append Log** (`appends` table) - Source of truth for all operations
- **Materialized Tables** - `notes`, `bullets`, `annotations`, `links`
- **Full-Text Search** - Postgres tsvector with GIN indexes
- **Automatic Indexing** - Database triggers update FTS on bullet insert/update

## Build Commands

```bash
# Frontend (React + Vite)
cd frontend
npm install
npm run dev              # Start Vite dev server on port 5173
npm run build           # Build for production

# Backend (Node + Express)
cd backend
npm install
npm run dev             # Start dev server with hot reload (nodemon + tsx)
npm run build          # Compile TypeScript to dist/
npm start              # Run compiled production build
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm test               # Run tests with Vitest
```

## Key Implementation Details

**Current Working State (Updated 2025-10-04):**
- ✅ **Phase 1** - Backend API complete (append log + materialized tables)
- ✅ **Phase 2** - Bullet editor with append-only commits
- ✅ **Phase 3** - Search, backlinks, and tasks fully functional
- ✅ Frontend integrated with real backend API
- ✅ Backend connected to Render Postgres database
- ✅ Optimistic UI updates for instant feedback
- ✅ **Bug Fixes** - All 10 user-reported issues resolved
- 🎯 **READY FOR PHASE 5** - Deployment to Render.com

**Append-Only Architecture:**
- Committed bullets are **immutable** (read-only after pressing Enter)
- Tab/Shift+Tab for visual indenting with dynamic depth/parent tracking
- All operations append to the `appends` table (bullets, annotations, redactions)
- Materialized views (`bullets`, `links`, `annotations`) derived from append log
- Idempotent appends via `clientSeq` tracking

**API Endpoints:**
- `POST /notes/:date/ensure` - Create daily note
- `GET /notes/:noteId` - Get bullets (with `?sinceSeq=X` for incremental sync)
- `POST /notes/:noteId/bullets/append` - Append single bullet
- `POST /notes/:noteId/bullets/appendBatch` - Bulk append
- `POST /annotations/append` - Add task/entity annotations
- `POST /redact` - Soft delete bullets (marks as redacted, preserves history)
- `GET /search?q=query` - Full-text search across bullets
- `GET /search/backlinks?target=NoteName` - Reverse wikilink references
- `GET /search/wikilinks?q=query` - Wikilink targets for autocomplete
- `GET /search/tasks` - All tasks with latest state

**Editor Features:**
- **Append-only commits:** Enter commits bullet → becomes read-only → new bullet created
- **Visual indenting:** Tab/Shift+Tab adjust depth, parent calculated on commit
- **Wikilink autocomplete:** `[[` opens dropdown, searches real link targets
- **Tag autocomplete:** `#` opens dropdown, searches existing tags
- **Error handling:** Retry banner for failed commits, optimistic UI with rollback
- **Tasks:** Auto-detect `[]` or `[ ]` syntax, cycle states (TODO → DOING → DONE)

**Database Schema:**
- Append log: `appends(seq, note_id, kind, payload, created_at)`
- Materialized: `notes`, `bullets`, `annotations`, `links`
- FTS: `bullets.text_tsv` with GIN index for fast search
- Soft deletes: `bullets.redacted` flag (never physically delete)

## Current Feature Status

**✅ Fully Working Features:**
1. **Daily Notes** - Auto-created on first access
2. **Append-Only Bullets** - Committed bullets are immutable, read-only
3. **Visual Indenting** - Tab/Shift+Tab with dynamic depth/parent tracking
4. **Wikilink Autocomplete** - `[[` trigger searches real link targets
5. **Tag Autocomplete** - `#` trigger searches existing tags
6. **Global Search** - Cmd+K searches all committed bullets
7. **Backlinks Panel** - Cmd+B shows bullets referencing current note
8. **Master Tasks View** - Ctrl+T with keyboard-first task management
9. **Task Detection** - Auto-detect `[]` or `[ ]` syntax on commit
10. **Optimistic UI** - Instant commit response, syncs in background
11. **Error Recovery** - Retry banner for failed commits
12. **Full-Text Search** - Postgres FTS with GIN indexes

**🔮 Future Enhancements:**
1. **Authentication** - JWT-based auth (Phase 5)
2. **Deployment** - Render.com deployment with managed Postgres (Phase 5)
3. **Offline Support** - Service worker for offline writes (Phase 6)
4. **Redaction UX** - Context menu to soft-delete bullets (Phase 6)
5. **AI Integration** - Automatic task detection, entity extraction, daily digest
6. **Semantic Search** - Embeddings with pgvector

## Development Notes

**Module System:**
- Frontend: ES modules (`"type": "module"` in package.json)
- Backend: CommonJS (`"type": "commonjs"` in package.json)
- Both use TypeScript with separate tsconfig files

**Database:**
- Postgres on Render.com (managed instance)
- Prisma for schema management and type-safe queries
- FTS triggers update `text_tsv` automatically on insert/update
- Foreign key constraints enforced for data integrity

**Editor Implementation:**
- Tiptap with custom ListItem extension
- Attributes: `data-committed`, `data-bullet-id`, `style` (for indenting)
- Keyboard handler intercepts all keys to enforce append-only
- Dynamic depth calculation from bulletList ancestor count
- Parent ID calculated as last committed bullet at depth-1

**Critical Implementation Details:**
- **Innermost ListItem Detection** - Must iterate through all descendants to find closest (innermost) listItem containing cursor
- **CSS Selector Specificity** - Use `li[data-committed="true"] > p` to prevent opacity inheritance to nested children
- **Span Extraction** - `extractSpans()` parses `[[wikilinks]]` and `#tags` into structured spans on commit

## Development Workflow

**Workflow Process:**
1. **Engineering Spec** → `docs/jnotes_eng_spec.md` - Technical specification and architecture
2. **Implementation Plan** → `docs/jnotes_impl_plan.md` - Phased development roadmap (reviewed by Claude, broken into phases)
3. **Iterate by Phase** → Work through phases with "DocStops" at key boundaries
4. **DocStops** → Update `CLAUDE.md` and `SESSION_CONTEXT.md` to capture progress

**Git Branching Strategy:**
- **One branch per phase** - Named `phase-N-description` (e.g., `phase-1-backend-api`)
- **Tag on completion** - Semantic versioning (e.g., `v0.3-frontend-complete`)
- **Merge to main** - When phase is complete and tested
- **Easy rollback** - Can always return to tagged states

**Current Development Status (Updated 2025-10-04):**
- ✅ **v0.3-frontend-complete** - Phase 2 & 3 complete (tagged)
  - Append-only bullet editor with depth tracking
  - Wikilink and tag autocomplete
  - Global search (Cmd+K), backlinks (Cmd+B), tasks (Ctrl+T)
- ✅ **Phase 1** - Backend API integration complete
  - Real cloud persistence with Postgres
  - Append log + materialized tables architecture
  - All endpoints working with frontend
- ✅ **Bug Fixes** - All 10 user-reported issues resolved (2025-10-04)
  - Daily note header with formatted date
  - Navigation with keyboard shortcuts (Cmd/Ctrl+↑/↓)
  - Tag search backend implementation
  - Bullet navigation and scrolling from search/tasks
  - Task list scroll-to-selection
  - Paste protection for committed bullets
  - Autocomplete spacing improvements
- 🎯 **READY FOR PHASE 5** - Render.com deployment

**Development Commands:**
```bash
# Frontend (React + Vite)
cd frontend
npm run dev              # Start Vite dev server on port 5173

# Backend (Node + Express)
cd backend
npm run dev              # Start dev server with hot reload

# Database operations
cd backend
npm run prisma:migrate   # Apply migrations
npm run prisma:generate  # Regenerate Prisma client
```

## Known Issues & Next Steps

**Current Status (2025-10-04):**
- All core features working with real backend API
- Backend connected to Render Postgres
- Frontend running locally on Vite dev server
- User testing complete, issues list generated

**Next Steps:**
1. **Phase 5 - Deployment** (2-3 days, ready to start)
   - Create `render.yaml` blueprint
   - Deploy backend to Render as web service
   - Deploy frontend to Render as static site
   - Implement JWT authentication
   - Configure CORS for production
   - Run migrations on production database
   - Load testing with 100k bullets

3. **Phase 6 - Polish & Hardening** (3-5 days)
   - Redaction UX (context menu to soft-delete)
   - Offline support with service worker
   - Error recovery improvements
   - Virtual scrolling for large days
   - Dark mode
   - Keyboard shortcuts help (Cmd+?)

**Breaking Changes from Electron Prototype:**
- Web app instead of desktop (browser-based, not Electron)
- Postgres instead of SQLite
- No editing of committed bullets (append-only enforced)
- No reordering bullets (append order is permanent)
- Soft delete only (redactions preserve history)

## Related Documentation

- **Engineering Spec:** `docs/jnotes_eng_spec.md` - Complete technical specification
- **Implementation Plan:** `docs/jnotes_impl_plan.md` - Phased development roadmap
- **Session Context:** `SESSION_CONTEXT.md` - Current session progress and implementation details
- **Issues List:** `docs/jnotes_issues_list.txt` - Bugs found during user testing

## Legacy Note

This repository previously contained an Electron app with SQLite (`simple.html`, `src/main/`). That was a proof-of-concept and has been superseded by the current web-based architecture described above. The Electron code may still exist in the repository but is not actively maintained.
