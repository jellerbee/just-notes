# jnotes - Session Context

**Date:** 2025-10-09
**Status:** ✅ v1.0.0 Production Release
**Branch:** `main`
**Latest Tag:** `v1.0.0` - Initial production release
**Latest Commit:** `400b682` - Handle null date field in tasks endpoint

---

## Completed Phases

### Phase 1 - Backend API Foundation ✅

**Implemented:**
1. ✅ Node/Express + TypeScript backend
2. ✅ Prisma ORM with Postgres schema
3. ✅ Append log + materialized tables architecture
4. ✅ Core API endpoints (ensure, append, get, redact)
5. ✅ Indexer service (spans parsing, FTS updates, link extraction)
6. ✅ Search and backlinks endpoints
7. ✅ Unit tests for idempotency and concurrent appends
8. ✅ Tag search endpoint (`GET /search/tags`)

**Architecture:**
- **Append log** (`appends`) - Source of truth for all operations
- **Materialized tables** - `notes`, `bullets`, `annotations`, `links`
- **Full-text search** - Postgres tsvector with GIN indexes
- **Automatic indexing** - DB triggers update FTS on bullet insert/update
- **Idempotency** - clientSeq tracking prevents duplicate appends

**API Endpoints:**
- `POST /notes/:date/ensure` - Create daily note
- `GET /notes/:noteId` - Get bullets (with `?sinceSeq=X`)
- `POST /notes/:noteId/bullets/append` - Append single bullet
- `POST /notes/:noteId/bullets/appendBatch` - Bulk append
- `POST /annotations/append` - Add task/entity annotations
- `POST /redact` - Soft delete bullets
- `GET /search?q=query` - FTS search across bullets
- `GET /search/backlinks?target=NoteName` - Backlinks
- `GET /search/wikilinks?q=query` - Wikilink targets for autocomplete
- `GET /search/tags?q=query` - Tag targets for autocomplete
- `GET /search/tasks` - All tasks with latest state

**Frontend Integration:**
- ✅ Replaced mockApi with real API client
- ✅ Optimistic UI updates (instant commit response)
- ✅ Wikilink autocomplete searches real link targets
- ✅ Tag autocomplete searches real tags
- ✅ Tasks modal shows real tasks from annotations
- ✅ All features working with Render Postgres database

**Deployment:**
- ✅ Backend connected to Render Postgres
- ✅ Backend deployed to Render.com (Phase 5)
- ✅ Authentication framework in place (Phase 5)

### Phase 2 - Bullet Editor Core ✅

1. ✅ Append-only committed bullets (read-only after Enter)
2. ✅ Tab/Shift+Tab visual indenting with dynamic depth/parent tracking
3. ✅ Wikilink autocomplete with `[[` trigger
4. ✅ Tag autocomplete with `#` trigger
5. ✅ Error handling with retry banner
6. ✅ Visual styling to distinguish committed vs uncommitted bullets
7. ✅ Paste protection - strips committed attributes from pasted content

### Phase 3 - Search, Backlinks, Tasks ✅

1. ✅ Global search (Cmd+K) - Search across all committed bullets
2. ✅ Backlinks panel (Cmd+B) - Show bullets referencing current note
3. ✅ Master tasks view (Ctrl+T) - Keyboard-first task management
4. ✅ Task detection - Auto-detect `[]` or `[ ]` syntax on commit
5. ✅ Navigation from search/tasks - Scrolls to specific bullet
6. ✅ Task list scrolling - Keeps selected task in view

### Phase 4 - Bug Fixes ✅ (2025-10-04)

**All 10 user-reported issues resolved:**

1. ✅ **Autocomplete spacing** - Added trailing space after tag/wikilink completion
   - Files: `frontend/src/components/BulletEditor.tsx:645, 665`

2. ✅ **Daily note header** - Added formatted date header (e.g., "October 4, 2025")
   - Files: `frontend/src/components/BulletEditor.tsx:680-770`
   - Features: Sticky header, large title font, navigation arrows

3. ✅ **Tag search backend** - Implemented `/search/tags` endpoint
   - Files: `backend/src/routes/search.ts:140-172`, `frontend/src/lib/api.ts:246-258`

4. ✅ **Search navigation** - Search results navigate to note and scroll to bullet
   - Files: `frontend/src/App.tsx:20-35`, `frontend/src/components/SearchModal.tsx:65-70`

5. ✅ **Daily note navigation** - Arrow buttons + keyboard shortcuts (Cmd/Ctrl+↑/↓)
   - Files: `frontend/src/components/BulletEditor.tsx:690-710`, `frontend/src/App.tsx:38-52`
   - Up arrow = older day, Down arrow = newer day

6. ✅ **Paste committed bullet fix** - Strips `data-committed` attributes on paste
   - Files: `frontend/src/components/BulletEditor.tsx:101-107`
   - Uses `transformPastedHTML` to clean pasted content

7. ✅ **Task list scrolling (downward)** - Selected task scrolls into view
   - Files: `frontend/src/components/TasksModal.tsx:72-80`

8. ✅ **Task navigation scrolling** - Enter on task scrolls bullet to top of view
   - Files: `frontend/src/components/BulletEditor.tsx:523-534`

9. ✅ **Navigate to bullet context** - All navigation scrolls to specific bullet
   - Files: `frontend/src/components/TasksModal.tsx:151-156`
   - Handles both parent and child bullets

10. ✅ **Task list scrolling (upward)** - Same scrollIntoView handles both directions
    - Files: `frontend/src/components/TasksModal.tsx:72-80`

### Phase 5 - Production Deployment ✅ (2025-10-05)

**Deployment Infrastructure:**
1. ✅ Created `render.yaml` blueprint for infrastructure-as-code deployment
2. ✅ Backend deployed to Render.com (Node.js web service)
3. ✅ Frontend deployed to Render.com (static site)
4. ✅ Connected to Render PostgreSQL database (`lifetrails-db`, Basic-1GB plan)
5. ✅ JWT authentication framework implemented (dev mode: auto-auth, prod: requires token)
6. ✅ CORS configured for production
7. ✅ Environment variables configured (`VITE_API_URL`, `CORS_ORIGIN`, `JWT_SECRET`)

**Production Testing:**
1. ✅ Load testing with 4,000 bullets across 30 daily notes
2. ✅ Full-text search performance verified (super fast response times)
3. ✅ Test data generation script created (`backend/scripts/generate-test-data.js`)
4. ✅ Database sequence fix script created (`backend/scripts/fix-sequence.sql`)

**Issues Fixed During Deployment:**
1. ✅ Hardcoded localhost URL in `App.tsx` - Now uses `VITE_API_URL`
2. ✅ Render.yaml configuration (static_site type, database plan name)
3. ✅ Prisma client location - Changed from custom path to default `@prisma/client`
4. ✅ TypeScript build issues - Added dev dependencies to build command
5. ✅ Database sequence conflicts - Created fix script for auto-increment reset

**Production URLs:**
- Frontend: `https://jnotes-frontend.onrender.com`
- Backend API: `https://jnotes-api.onrender.com`

**Session 2025-10-07 Updates (Issues #1-#3):**
1. ✅ Fixed Issue #1 - Ghost bullets (rollback optimistic UI on error)
2. ✅ Fixed Issue #2 - Wikilink navigation (custom Tiptap extension)
3. ✅ Fixed Issue #3 - Backlinks work (confirmed + fixed named note bug)
4. ✅ Added arbitrary note names support (daily vs named notes)
5. ✅ Added note type differentiation in UI (Today button, arrow nav)
6. ✅ Added Cmd/Ctrl+H shortcut to go to today

### Phase 6 - Polish & Hardening ✅ (2025-10-07)

**Completed Tasks:**

1. ✅ **Test Data Cleanup** - Added `test_data` flag migration
2. ✅ **Redaction UX** - Context menu and hide/show toggle
3. ✅ **Offline Support** - Service worker + IndexedDB queue
4. ✅ **Modal Pagination** - TasksModal and SearchModal (50 items/page)
5. ✅ **Keyboard Shortcuts Help** - Cmd+/ modal

### Production Release - v1.0.0 ✅ (2025-10-09)

**Final Bug Fixes (Issues #3-#10):**

1. ✅ **Issue #3** - Service worker cache error
   - Fixed STATIC_ASSETS array to only cache `/` and `/index.html`
   - Removed non-existent source paths that caused cache errors

2. ✅ **Issue #4** - Search modal doesn't scroll selected result
   - Added scrollIntoView effect for search results navigation
   - Added className to result items for targeting

3. ✅ **Issue #5** - Wikilinks not clickable after creation
   - Applied wikilink marks on commit using regex pattern matching
   - Makes `[[target]]` patterns clickable immediately after Enter

4. ✅ **Issue #6** - Use strikeout instead of "Redacted" text
   - Changed CSS from italic text to `text-decoration: line-through`
   - Improved visual distinction for redacted bullets

5. ✅ **Issue #7** - Redaction dialog should be modal
   - Converted RedactionModal from Tailwind to inline styles
   - Proper modal overlay with backdrop blur

6. ✅ **Issue #8** - Hide/Show redacted button not working
   - Fixed by returning all bullets from backend (removed `redacted: false` filter)
   - Frontend handles display via CSS `.hide-redacted` class

7. ✅ **Issue #9** - Redacted bullets disappear on refresh
   - Fixed by returning all bullets from backend
   - Added `data-redacted` attribute to ListItem extension
   - Bullets persist with proper redacted styling

8. ✅ **Issue #10** - Cursor placed below empty bullet
   - Fixed Tiptap document structure understanding
   - Use second-to-last paragraph (inside last list item) instead of last
   - Applied to both page navigation AND Enter key scenarios

**Release Management:**
- Created `docs/RELEASE_PROCESS.md` with monthly release schedule
- Created `docs/releases/v1.0.0-release-notes.md`
- Tagged v1.0.0 and created GitHub release
- Established hotfix process for critical bugs
- All 10 issues (#1-#10) closed on GitHub

---

## Core Implementation

### 1. Append-Only Bullet Commits

**File:** `/frontend/src/components/BulletEditor.tsx`

**Extended ListItem (lines ~64-94):**
```typescript
ListItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-committed': { ... },
      'data-bullet-id': { ... },
      style: { ... }  // For visual indent
    }
  }
})
```

**Keyboard Handler (lines ~108-267):**
- Finds **innermost** (closest) listItem containing cursor - critical for nested bullets
- Blocks all text modification in committed bullets
- Allows navigation keys and copy operations
- Smart Enter handling in committed bullets
- **Paste protection:** `transformPastedHTML` strips committed attributes (lines 101-107)

**Key Fix:** Changed from `return false` (stops on first match) to continuing iteration to find the **innermost** listItem

### 2. Tab/Shift+Tab Depth Tracking

**Implementation:** Tiptap's native indent/outdent for visual structure, dynamic depth calculation on commit

**Dynamic Depth Calculation (lines ~314-343):**
```typescript
// Count bulletList ancestors to determine depth
let depth = 0
doc.nodesBetween(0, doc.content.size, (node, nodePos) => {
  if (nodePos < pos && nodePos + node.nodeSize > pos && node.type.name === 'bulletList') {
    depth++
  }
})
depth = Math.max(0, depth - 1) // Root bulletList doesn't count

// Find parent: last committed bullet at depth-1
let parentId = null
if (depth > 0) {
  doc.nodesBetween(0, listItemPos, (node, nodePos) => {
    if (node.type.name === 'listItem' && node.attrs['data-committed'] === 'true') {
      // Calculate this node's depth same way
      let nodeDepth = ...
      if (nodeDepth === depth - 1) {
        parentId = node.attrs['data-bullet-id']
      }
    }
  })
}
```

### 3. Daily Note Header & Navigation

**File:** `/frontend/src/components/BulletEditor.tsx` (lines 714-770)

**Features:**
- Sticky header at top of editor
- Formatted date title (e.g., "October 4, 2025")
- Navigation arrows: ↑ = older day, ↓ = newer day
- Keyboard shortcuts: Cmd/Ctrl+↑ (previous) / Cmd/Ctrl+↓ (next)
- Prevents conflicts with autocomplete

**Date Formatting:**
```typescript
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}
```

### 4. Bullet Navigation & Scrolling

**File:** `/frontend/src/components/BulletEditor.tsx` (lines 523-534)

**Implementation:**
- `scrollToBulletId` prop passed from App.tsx
- After loading bullets, scrolls to specific bullet if requested
- Uses `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- 100ms delay ensures DOM is ready

**Flow:**
1. User clicks search result or task
2. App navigates to note with `bulletId` parameter
3. BulletEditor loads bullets
4. After loading, finds bullet by `data-bullet-id` attribute
5. Scrolls bullet to top of viewport

### 5. Wikilink Autocomplete

**Trigger:** `[[` detection (lines ~544-579)
**Search:** `api.searchNotes()` - searches wikilink targets from links table
**UI:** Blue dropdown with cursor-positioned absolute positioning
**Selection:** Arrow keys navigate, Enter/Tab select
**Spacing:** Added trailing space after completion (line 665)
**Span Extraction:** `extractSpans()` function (lines ~433-471) extracts `[[target]]` into structured spans
**Navigation:** Custom Tiptap extension makes wikilinks clickable

### 6. Tag Autocomplete

**Trigger:** `#` detection at word boundary (lines ~581-635)
**Search:** `api.searchTags()` - searches tag targets from links table
**Backend:** `GET /search/tags?q=query` endpoint (backend/src/routes/search.ts:140-172)
**UI:** Green dropdown with cursor-positioned absolute positioning
**Selection:** Arrow keys navigate, Enter/Tab select
**Spacing:** Added trailing space after completion (line 645)
**Span Extraction:** `extractSpans()` extracts `#tag` into structured spans

### 7. Error Handling

**State:** `commitError`, `failedBulletText` (lines ~39-40)
**Banner:** Red fixed-position banner with Retry/Dismiss buttons
**Retry Logic:** `retryCommit()` function (lines ~415-431)
**Optimistic UI:** Rollback on error to prevent ghost bullets

### 8. Visual Styling

**File:** `/frontend/src/index.css`

**Committed Bullets (lines 92-99):**
```css
.ProseMirror li[data-committed="true"] > p {
  color: rgba(0, 0, 0, 0.5);
  opacity: 0.7;
}
```

**Redacted Bullets (lines 119-126):**
```css
.ProseMirror li[data-redacted="true"] > p {
  color: #999 !important;
  font-style: italic;
  opacity: 0.6;
}

.hide-redacted li[data-redacted="true"] {
  display: none;
}
```

**Key:** Using `> p` (direct child selector) prevents opacity inheritance to nested uncommitted children

### 9. Offline Support

**Service Worker (`frontend/public/sw.js`):**
- Cache-first for static assets (HTML, CSS, JS, images)
- Network-first for API calls
- Background sync for queued appends
- Handles offline/online events

**IndexedDB Queue (`frontend/src/lib/offlineQueue.ts`):**
- Persists failed appends with bulletId, noteId, payload
- Tracks retry count (max 3 retries)
- Provides enqueue, dequeue, getAll, count methods

**Sync Status (`frontend/src/components/SyncStatus.tsx`):**
- Visual indicator: Online (green) / Offline (orange) / Pending (yellow) / Syncing (blue)
- Manual "Sync Now" button as fallback for browsers without background sync
- Fixed position bottom-right corner

### 10. Pagination

**TasksModal & SearchModal:**
- Page size: 50 items per page
- Keyboard navigation: PageUp/PageDown, Cmd/Ctrl+←/→
- UI controls: Previous/Next buttons, page indicator
- Only shown when totalPages > 1
- Resets to page 1 on filter/search change

---

## Critical Bugs Fixed

### Bug 1: Keys Eaten After Tab
**Symptom:** After Tab, all keystrokes blocked in indented bullet
**Root Cause:** Finding parent listItem instead of child after Tab
**Fix:** Changed descendants loop to find **innermost** listItem by not returning early

### Bug 2: Child Bullets Dim Before Commit
**Symptom:** Uncommitted child bullets appeared dimmed like their committed parent
**Root Cause:** CSS opacity inherited to nested children
**Fix:** Changed selector from `li[data-committed="true"]` to `li[data-committed="true"] > p`

### Bug 3: Cannot Commit Child Bullets
**Symptom:** Enter in child bullet showed "already committed" error
**Root Cause:** `handleCommit` also finding parent instead of child
**Fix:** Applied same innermost-finding pattern to `handleCommit`

### Bug 4: Pasted Committed Content Makes Bullet Committed
**Symptom:** Pasting from committed bullet made current bullet uneditable
**Root Cause:** Pasted HTML includes `data-committed="true"` attribute
**Fix:** Added `transformPastedHTML` to strip committed attributes (lines 101-107)

### Bug 5: Search/Tasks Don't Navigate to Bullet
**Symptom:** Clicking search result or task loads note but doesn't scroll to bullet
**Root Cause:** No scroll logic after navigation
**Fix:**
- Added `scrollToBulletId` prop to Note type and BulletEditor
- SearchModal and TasksModal pass bulletId when navigating
- BulletEditor scrolls to bullet after loading (lines 523-534)

### Bug 6: Task List Doesn't Keep Selection in View
**Symptom:** Arrow keys in task modal don't scroll selected task into view
**Root Cause:** No scroll logic on selection change
**Fix:** Added `scrollIntoView` effect in TasksModal (lines 72-80)

### Bug 7: Ghost Bullets (Issue #1)
**Symptom:** Failed commits leave uncommitted bullet in DOM
**Root Cause:** Optimistic UI doesn't rollback on error
**Fix:** Added rollback logic to remove bullet from editor on commit failure

### Bug 8: Wikilink Navigation (Issue #2)
**Symptom:** Clicking wikilinks doesn't navigate to target note
**Root Cause:** No click handler on wikilink spans
**Fix:** Created custom Tiptap extension with click handler to navigate

### Bug 9: Backlinks (Issue #3)
**Symptom:** Backlinks panel not showing results for named notes
**Root Cause:** Backend query only checked date field, not title field
**Fix:** Updated backlinks query to check both date and title

### Bug 10: Prisma tsvector Deserialization
**Symptom:** Database error when creating bullets after migration
**Root Cause:** Prisma can't deserialize tsvector type
**Fix:**
- Changed schema to mark `text_tsv` as `Unsupported("tsvector")`
- Updated bullet creation to only select `id` field (avoids returning tsvector)

### Bug 11: Service Worker Cache Error (Issue #3)
**Symptom:** Cache errors in production for non-existent source files
**Root Cause:** STATIC_ASSETS included `/src/main.tsx` and `/src/index.css` which don't exist in production build
**Fix:** Removed non-existent paths, only cache `/` and `/index.html`

### Bug 12: Cursor Positioning Below Empty Bullet (Issue #10)
**Symptom:** Cursor appears on line below empty bullet instead of inside it
**Root Cause:** Tiptap adds extra paragraph node outside lists, targeting wrong paragraph
**Fix:** Use second-to-last paragraph (inside last list item) instead of last paragraph
**Files:** `frontend/src/components/BulletEditor.tsx:653-679, 303-316`

---

## Architecture

### Frontend (React + Tiptap)
- Single Tiptap editor (`StarterKit` with custom `ListItem`)
- Custom attributes track committed state and bullet IDs
- Keyboard handler intercepts and blocks editing on committed bullets
- Dynamic depth/parent calculation from document structure
- Paste protection via `transformPastedHTML`
- Custom Wikilink extension for clickable navigation
- Service worker + IndexedDB for offline support
- Pagination for modals with 50 items/page

### Backend (Node + Express + Prisma)
- RESTful API with append-only operations
- Postgres database on Render.com
- Indexer service parses spans and updates FTS
- Tag search endpoint for autocomplete
- Redaction endpoint for soft deletes
- Full-text search with tsvector (marked as Unsupported in Prisma)

---

## Files Modified (Phase 6 - Session 2025-10-07)

**Backend:**
- `/backend/prisma/schema.prisma` - Added test_data, note_type, title fields; marked text_tsv as Unsupported
- `/backend/prisma/migrations/20251007221309_init/` - Fresh migration with all schema updates
- `/backend/src/services/indexer.ts` - Fixed tsvector deserialization (select id only)
- `/backend/scripts/generate-test-data.js` - Updated to set testData: true

**Frontend:**
- `/frontend/public/sw.js` - Created service worker for offline support
- `/frontend/src/components/RedactionModal.tsx` - Created redaction confirmation modal
- `/frontend/src/components/SyncStatus.tsx` - Created sync status indicator
- `/frontend/src/components/KeyboardHelpModal.tsx` - Created keyboard shortcuts help
- `/frontend/src/components/BulletEditor.tsx` - Added redaction context menu, hide redacted toggle
- `/frontend/src/components/TasksModal.tsx` - Added pagination (50 tasks/page)
- `/frontend/src/components/SearchModal.tsx` - Added pagination (50 results/page)
- `/frontend/src/lib/offlineQueue.ts` - Created IndexedDB queue manager
- `/frontend/src/lib/serviceWorker.ts` - Created service worker manager
- `/frontend/src/lib/api.ts` - Updated to queue writes when offline
- `/frontend/src/App.tsx` - Added KeyboardHelpModal, SyncStatus, Cmd+/ hotkey
- `/frontend/src/main.tsx` - Initialize offline queue, register service worker
- `/frontend/src/index.css` - Added redacted bullet styles

**Documentation:**
- `/CLAUDE.md` - Updated with Phase 6 completion
- `/SESSION_CONTEXT.md` - This file

---

## Testing Scenarios (All Passing ✅)

1. ✅ Type text → Enter → bullet commits and dims, new bullet created
2. ✅ Type text → Tab → bullet indents visually → type → Enter → commits with depth=1
3. ✅ Type `[[` → dropdown appears → arrow keys navigate → Enter selects → space added
4. ✅ Type `#` → dropdown appears → arrow keys navigate → Enter selects → space added
5. ✅ Committed bullet shows dimmed, child bullet stays full brightness
6. ✅ Cannot type in committed bullet, can copy text
7. ✅ Tab/Shift+Tab indent/outdent work at any depth
8. ✅ Parent-child relationships tracked correctly on commit
9. ✅ Paste committed bullet doesn't make current bullet committed
10. ✅ Search result navigates to note and scrolls to bullet
11. ✅ Task Enter navigates to note and scrolls to bullet
12. ✅ Task list arrow keys keep selection in view
13. ✅ Daily note navigation with arrows and Cmd/Ctrl+↑/↓
14. ✅ Wikilinks are clickable and navigate correctly
15. ✅ Backlinks work for both daily and named notes
16. ✅ Ghost bullets rollback on commit failure
17. ✅ Right-click committed bullet → redact confirmation → bullet redacted
18. ✅ Hide redacted toggle hides/shows redacted bullets
19. ✅ Offline writes queue in IndexedDB → sync when online
20. ✅ TasksModal pagination (50 tasks/page, PageUp/PageDown)
21. ✅ SearchModal pagination (50 results/page, PageUp/PageDown)
22. ✅ Cmd+/ shows keyboard shortcuts help modal

---

## Known Issues

### ✅ All Issues Resolved (v1.0.0 - 2025-10-09)
- Issue #1: Offline sync failure - **FIXED** (idempotency key upsert)
- Issue #2: Search pagination - **FIXED** (removed LIMIT 50)
- Issue #3: Service worker cache error - **FIXED** (removed non-existent source paths)
- Issue #4: Search modal scroll - **FIXED** (scrollIntoView effect)
- Issue #5: Wikilinks not clickable - **FIXED** (apply marks on commit)
- Issue #6: Redaction styling - **FIXED** (strikethrough instead of text replacement)
- Issue #7: Redaction modal styling - **FIXED** (inline styles)
- Issue #8: Hide/Show redacted button - **FIXED** (CSS class toggle)
- Issue #9: Redacted bullets disappear - **FIXED** (return all bullets from backend)
- Issue #10: Cursor positioning - **FIXED** (second-to-last paragraph)

**No known issues at this time.**

### Future Enhancements (Phase 7 - Optional)
- **AI Integration** - Automatic task detection, entity extraction, daily digest
- **Semantic search** - Embeddings with pgvector
- **Performance optimization** - Virtual scrolling for very large days (>200 bullets)
- **Dark mode** - User preference for dark theme

---

## Next Steps

**Current Status (v1.0.0 - 2025-10-09):**
- ✅ **v1.0.0 PRODUCTION RELEASE COMPLETE**
- ✅ All Phases 1-6 complete
- ✅ All 10 critical bugs fixed (#1-#10)
- ✅ Production deployment live on Render.com
- ✅ Release process established (monthly releases + hotfixes)
- ✅ Release notes and documentation complete

**Release Management:**
- Monthly releases scheduled for 1st week of each month
- Hotfix process defined for critical bugs only
- See `docs/RELEASE_PROCESS.md` for details
- Next release: TBD (based on feature needs)

**Phase 7 - AI Integration (Future - Optional):**
1. Automatic task detection from bullet text
2. Entity extraction and linking
3. Daily digest generation
4. Smart search with embeddings (pgvector)
5. Bullet suggestions and auto-completion

**Recommended Focus:**
- User testing and feedback
- Performance monitoring
- Monthly feature releases
- Bug fixes as discovered

---

## Git Status

**Branch:** `main`
**Latest Tag:** `v1.0.0` - Production release (2025-10-09)
**Latest Commit:** `400b682` - Handle null date field in tasks endpoint
**Status:** Pushed to remote

**Release History:**
- `v1.0.0` - Initial production release (2025-10-09)
- `v0.6-phase-6-complete` - Polish & Hardening complete (2025-10-07)
- `v0.5-production-deployed` - Phase 5 complete (2025-10-05)
- `v0.4-bug-fixes-complete` - All 10 bugs fixed (2025-10-04)
- `v0.3-frontend-complete` - Phase 2 & 3 complete (2025-10-04)

**GitHub Release:**
- https://github.com/jellerbee/just-notes/releases/tag/v1.0.0

---

## Related Documentation

- **Engineering Spec:** `/docs/jnotes_eng_spec.md` - Technical specification and architecture
- **Implementation Plan:** `/docs/jnotes_impl_plan.md` - Phased development roadmap
- **Project README:** `/CLAUDE.md` - Project overview and current status
- **Testing Notes:** `/docs/TESTING_NOTES.md` - Production testing results
- **Deployment Guide:** `/docs/DEPLOYMENT.md` - Render.com deployment instructions
- **Release Process:** `/docs/RELEASE_PROCESS.md` - Monthly release and hotfix workflow
- **Release Notes:** `/docs/releases/v1.0.0-release-notes.md` - v1.0.0 production release
