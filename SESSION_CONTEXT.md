# jnotes - Session Context

**Date:** 2025-10-04
**Status:** ✅ All Core Features Complete - Ready for Deployment (Phase 5)
**Branch:** `main`

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
- ⏳ Deploy backend to Render.com (Phase 5)
- ⏳ Authentication (Phase 5)

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

### Bug Fix Phase ✅ (2025-10-04)

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

### 6. Tag Autocomplete

**Trigger:** `#` detection at word boundary (lines ~581-635)
**Search:** `api.searchTags()` - searches tag targets from links table (NEW!)
**Backend:** `GET /search/tags?q=query` endpoint (backend/src/routes/search.ts:140-172)
**UI:** Green dropdown with cursor-positioned absolute positioning
**Selection:** Arrow keys navigate, Enter/Tab select
**Spacing:** Added trailing space after completion (line 645)
**Span Extraction:** `extractSpans()` extracts `#tag` into structured spans

### 7. Error Handling

**State:** `commitError`, `failedBulletText` (lines ~39-40)
**Banner:** Red fixed-position banner with Retry/Dismiss buttons
**Retry Logic:** `retryCommit()` function (lines ~415-431)

### 8. Visual Styling

**File:** `/frontend/src/index.css`

**Committed Bullets (lines 92-99):**
```css
.ProseMirror li[data-committed="true"] > p {
  color: rgba(0, 0, 0, 0.5);
  opacity: 0.7;
}
```

**Key:** Using `> p` (direct child selector) prevents opacity inheritance to nested uncommitted children

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

---

## Architecture

### Frontend (React + Tiptap)
- Single Tiptap editor (`StarterKit` with custom `ListItem`)
- Custom attributes track committed state and bullet IDs
- Keyboard handler intercepts and blocks editing on committed bullets
- Dynamic depth/parent calculation from document structure
- Paste protection via `transformPastedHTML`

### Backend (Node + Express + Prisma)
- RESTful API with append-only operations
- Postgres database on Render.com
- Indexer service parses spans and updates FTS
- Tag search endpoint for autocomplete

---

## Files Modified (Session 2025-10-04)

**Frontend:**
- `/frontend/src/components/BulletEditor.tsx` - Added header, navigation, paste protection, scroll-to-bullet
- `/frontend/src/components/SearchModal.tsx` - Updated to pass bulletId on navigation
- `/frontend/src/components/TasksModal.tsx` - Added scroll-to-task, navigation integration
- `/frontend/src/App.tsx` - Added navigation functions, scroll-to-bullet support
- `/frontend/src/lib/api.ts` - Implemented tag search endpoint
- `/frontend/src/types/index.ts` - Added scrollToBulletId to Note interface

**Backend:**
- `/backend/src/routes/search.ts` - Added `/search/tags` endpoint

**Documentation:**
- `/docs/jnotes_issues_list.txt` - Added future issue for task modal paging
- `/CLAUDE.md` - Updated with current architecture and status
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

---

## Known Issues

### None (Critical)
All user-reported issues resolved.

### Future Enhancements
- **Task modal paging** - For performance with large task lists (captured in issues list)
- **Semantic search** - Embeddings with pgvector
- **Offline support** - Service worker for offline writes
- **Redaction UX** - Context menu to soft-delete bullets

---

## Next Steps

**Current Status (2025-10-04):**
- ✅ All Phase 1-3 features complete
- ✅ All user-reported bugs fixed
- ✅ Backend connected to Render Postgres
- ✅ Frontend fully functional with real API
- 🎯 **READY FOR PHASE 5 DEPLOYMENT**

**Phase 5 - Deployment to Render.com (Next):**
1. Create `render.yaml` blueprint
2. Deploy backend to Render as web service
3. Deploy frontend to Render as static site
4. Implement JWT authentication
5. Configure CORS for production
6. Run migrations on production database
7. Load testing with 100k bullets

**Phase 6 - Polish & Hardening:**
1. Redaction UX (context menu to soft-delete)
2. Offline support with service worker
3. Error recovery improvements
4. Virtual scrolling for large days
5. Dark mode
6. Keyboard shortcuts help (Cmd+?)
7. Task modal paging

---

## Git Status

**Branch:** `main`
**Latest Tag:** `v0.4-bug-fixes-complete` ✅
**Latest Commit:** `9b35221` - "feat: Complete bug fix phase - all 10 user issues resolved"
**Status:** Pushed to GitHub (origin/main)

**Commit Summary:**
- 11 files changed, 736 insertions(+), 292 deletions(-)
- All bug fixes committed and tagged
- Ready for Phase 5 deployment

---

## Related Documentation

- **Engineering Spec:** `/docs/jnotes_eng_spec.md` - Technical specification and architecture
- **Implementation Plan:** `/docs/jnotes_impl_plan.md` - Phased development roadmap
- **Project README:** `/CLAUDE.md` - Project overview and current status
- **Issues List:** `/docs/jnotes_issues_list.txt` - User-reported bugs (all resolved + 1 future enhancement)
