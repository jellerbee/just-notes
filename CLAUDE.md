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

**Current Working State (v1.0.0 - Updated 2025-10-09):**
- ✅ **v1.0.0 PRODUCTION RELEASE COMPLETE**
- ✅ **Phase 1** - Backend API complete (append log + materialized tables)
- ✅ **Phase 2** - Bullet editor with append-only commits
- ✅ **Phase 3** - Search, backlinks, and tasks fully functional
- ✅ **Phase 4** - Bug Fixes - All 10 user-reported issues resolved
- ✅ **Phase 5** - Production deployment to Render.com
- ✅ **Phase 6** - Polish & Hardening (offline support, redaction UX, pagination)
- ✅ Frontend deployed as static site on Render
- ✅ Backend deployed as web service on Render
- ✅ JWT authentication framework in place
- ✅ Production testing complete (4,000 bullets, FTS verified)
- ✅ All 10 critical bugs fixed (#1-#10)
- ✅ Release management process established
- 🎯 **PRODUCTION READY** - Optional Phase 7 (AI Integration)

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

**✅ Production Deployment (Phase 5):**
1. **JWT Authentication** - Framework in place (dev mode: auto-auth, prod: requires token)
2. **Render.com Deployment** - Backend + Frontend live on Render
3. **Production Database** - Postgres Basic-1GB plan on Render
4. **Load Testing** - Verified with 4,000 bullets, FTS super fast

**✅ Phase 6 - Polish & Hardening (2025-10-07):**
1. **Offline Support** - Service worker + IndexedDB queue for offline writes
2. **Redaction UX** - Context menu to soft-delete bullets, hide/show toggle
3. **Pagination** - TasksModal and SearchModal paginate at 50 items/page
4. **Keyboard Help** - Cmd+/ shows all keyboard shortcuts
5. **Test Data Cleanup** - Migration added `test_data` flag for easy cleanup

**✅ Production Release - v1.0.0 (2025-10-09):**
1. **Issue #3** - Fixed service worker cache error (removed non-existent source paths)
2. **Issue #4** - Search modal scrolls selected result into view
3. **Issue #5** - Wikilinks clickable after creation (apply marks on commit)
4. **Issue #6** - Redacted bullets use strikethrough styling
5. **Issue #7** - Redaction modal styled with inline CSS
6. **Issue #8** - Hide/Show redacted button working
7. **Issue #9** - Redacted bullets persist on refresh
8. **Issue #10** - Cursor positioned inside empty bullet (not below)

**🔮 Future Enhancements (Phase 7 - Optional):**
1. **AI Integration** - Automatic task detection, entity extraction, daily digest
2. **Semantic Search** - Embeddings with pgvector
3. **Performance** - Virtual scrolling for very large days (>200 bullets)
4. **Dark Mode** - User preference for dark theme

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

**Current Development Status (v1.0.0 - Updated 2025-10-09):**
- ✅ **v1.0.0** - PRODUCTION RELEASE (tagged 2025-10-09)
  - All Phases 1-6 complete
  - All 10 critical bugs fixed (#1-#10)
  - Release management process established
  - Production-ready and deployed
  - GitHub release: https://github.com/jellerbee/just-notes/releases/tag/v1.0.0
- ✅ **v0.6-phase-6-complete** - Phase 6 complete (tagged 2025-10-07)
  - Offline support, redaction UX, pagination, keyboard help
- ✅ **v0.5-production-deployed** - Phase 5 complete (tagged 2025-10-05)
  - Backend + Frontend deployed to Render.com
  - JWT authentication framework
  - Production testing verified
- ✅ **v0.4-bug-fixes-complete** - Bug fixes (tagged 2025-10-04)
- ✅ **v0.3-frontend-complete** - Phase 2 & 3 complete (tagged 2025-10-04)
- 🎯 **Phase 7 (Optional)** - AI Integration (future enhancement)

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

**Current Status (v1.0.0 - 2025-10-09):**
- ✅ **v1.0.0 PRODUCTION RELEASE COMPLETE**
- ✅ All Phases 1-6 complete
- ✅ All 10 critical bugs fixed (#1-#10)
- ✅ Backend deployed to Render.com
- ✅ Frontend deployed to Render.com
- ✅ Production testing complete (4,000 bullets)
- ✅ Release management process established

**All Known Issues Resolved (v1.0.0 - 2025-10-09):**
- ~~Issue #1: Offline sync failure~~ - ✅ Fixed (idempotency key upsert)
- ~~Issue #2: Search pagination~~ - ✅ Fixed (removed LIMIT 50)
- ~~Issue #3: Service worker cache error~~ - ✅ Fixed (removed non-existent paths)
- ~~Issue #4: Search modal scroll~~ - ✅ Fixed (scrollIntoView effect)
- ~~Issue #5: Wikilinks not clickable~~ - ✅ Fixed (apply marks on commit)
- ~~Issue #6: Redaction styling~~ - ✅ Fixed (strikethrough)
- ~~Issue #7: Redaction modal styling~~ - ✅ Fixed (inline styles)
- ~~Issue #8: Hide/Show redacted button~~ - ✅ Fixed (CSS class toggle)
- ~~Issue #9: Redacted bullets disappear~~ - ✅ Fixed (return all bullets)
- ~~Issue #10: Cursor positioning~~ - ✅ Fixed (second-to-last paragraph)

**No known issues at this time.**

**Release Management:**
- Monthly releases scheduled for 1st week of each month
- Hotfix process defined for critical bugs only
- See `docs/RELEASE_PROCESS.md` for complete workflow
- GitHub releases: https://github.com/jellerbee/just-notes/releases

**Future Enhancements (Phase 7 - Optional):**
1. **AI Integration** - Automatic task detection from bullet text
2. **Entity Extraction** - Auto-link people, places, projects
3. **Daily Digest** - AI-generated summary of day's notes
4. **Semantic Search** - Embeddings with pgvector
5. **Auto-completion** - AI-powered bullet suggestions

**Recommended Focus:**
- User testing and feedback
- Performance monitoring
- Monthly feature releases
- Bug fixes as discovered

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
- **Testing Notes:** `docs/TESTING_NOTES.md` - Production testing results and known issues
- **Deployment Guide:** `docs/DEPLOYMENT.md` - Render.com deployment instructions
- **Release Process:** `docs/RELEASE_PROCESS.md` - Monthly release and hotfix workflow
- **Release Notes:** `docs/releases/v1.0.0-release-notes.md` - v1.0.0 production release

## Legacy Note

This repository previously contained an Electron app with SQLite (`simple.html`, `src/main/`). That was a proof-of-concept and has been superseded by the current web-based architecture described above. The Electron code may still exist in the repository but is not actively maintained.

## Test Data Management

The database includes test data for development and testing. It can be safely destroyed and regenerated using the provided script:

**Generate test data:**
```bash
cd backend
node scripts/generate-test-data.js
```

**Clean up test data:**
```bash
cd backend
node scripts/generate-test-data.js --cleanup
```

All test notes are marked with `testData: true` in the `notes` table for easy identification and cleanup.