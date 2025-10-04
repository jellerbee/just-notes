# jnotes - Session Context

**Date:** 2025-10-03
**Status:** ✅ Phase 1 Complete - Backend API Ready
**Branch:** `phase-1-backend-api`

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
- `GET /search/tasks` - All tasks with latest state

**Frontend Integration:**
- ✅ Replaced mockApi with real API client
- ✅ Optimistic UI updates (instant commit response)
- ✅ Wikilink autocomplete searches real link targets
- ✅ Tag autocomplete (placeholder)
- ✅ Tasks modal shows real tasks from annotations
- ✅ All features working with Render Postgres database

**Deployment:**
- ✅ Backend connected to Render Postgres
- ✅ FTS triggers applied
- ⏳ Deploy backend to Render.com (Phase 5)
- ⏳ Authentication (Phase 5)

### Phase 2 - Bullet Editor Core ✅

1. ✅ Append-only committed bullets (read-only after Enter)
2. ✅ Tab/Shift+Tab visual indenting with dynamic depth/parent tracking
3. ✅ Wikilink autocomplete with `[[` trigger
4. ✅ Tag autocomplete with `#` trigger
5. ✅ Error handling with retry banner
6. ✅ Visual styling to distinguish committed vs uncommitted bullets

### Phase 3 - Search, Backlinks, Tasks ✅

1. ✅ Global search (Cmd+K) - Search across all committed bullets
2. ✅ Backlinks panel (Cmd+B) - Show bullets referencing current note
3. ✅ Master tasks view (Ctrl+T) - Keyboard-first task management
4. ✅ Task detection - Auto-detect `[]` or `[ ]` syntax on commit

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

**Keyboard Handler (lines ~98-263):**
- Finds **innermost** (closest) listItem containing cursor - critical for nested bullets
- Blocks all text modification in committed bullets
- Allows navigation keys and copy operations
- Smart Enter handling in committed bullets

**Key Fix:** Changed from `return false` (stops on first match) to continuing iteration to find the **innermost** listItem:
```typescript
doc.descendants((node, pos) => {
  if (node.type.name === 'listItem' && pos < selection.from && pos + node.nodeSize > selection.from) {
    // Always update - gets innermost (last found) listItem
    currentListItem = node
    currentListItemPos = pos
    isInCommittedBullet = node.attrs['data-committed'] === 'true'
  }
})
```

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

**Why this approach:**
- No manual state tracking (depth/parent state variables removed)
- Tiptap handles visual indenting natively
- Depth and parent calculated from document structure on commit
- Works correctly with nested bullets

### 3. Wikilink Autocomplete

**Trigger:** `[[` detection (lines ~509-563)
**Search:** `mockApi.searchNotes()` - searches by date substring
**UI:** Blue dropdown with cursor-positioned absolute positioning
**Selection:** Arrow keys navigate, Enter/Tab select
**Span Extraction:** `extractSpans()` function (lines ~433-471) extracts `[[target]]` into structured spans

### 4. Tag Autocomplete

**Trigger:** `#` detection at word boundary (lines ~565-619)
**Search:** `mockApi.searchTags()` - extracts unique tags from existing bullets
**UI:** Green dropdown with cursor-positioned absolute positioning
**Selection:** Arrow keys navigate, Enter/Tab select
**Span Extraction:** `extractSpans()` extracts `#tag` into structured spans

### 5. Error Handling

**State:** `commitError`, `failedBulletText` (lines ~39-40)
**Banner:** Red fixed-position banner with Retry/Dismiss buttons (lines ~655-698)
**Retry Logic:** `retryCommit()` function (lines ~415-431)

### 6. Visual Styling

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

---

## Architecture

### Frontend (React + Tiptap)
- Single Tiptap editor (`StarterKit` with custom `ListItem`)
- Custom attributes track committed state and bullet IDs
- Keyboard handler intercepts and blocks editing on committed bullets
- Dynamic depth/parent calculation from document structure

### Backend (Mock API)
- `/frontend/src/lib/mockApi.ts` - In-memory storage
- `appendBullet(noteId, { bulletId, parentId, depth, text, spans })`
- `searchNotes(query)` - Returns notes matching date substring
- `searchTags(query)` - Extracts and filters unique tags from spans
- No update/edit methods (append-only by design)

---

## Testing Scenarios (All Passing ✅)

1. ✅ Type text → Enter → bullet commits and dims, new bullet created
2. ✅ Type text → Tab → bullet indents visually → type → Enter → commits with depth=1
3. ✅ Type `[[` → dropdown appears → arrow keys navigate → Enter selects
4. ✅ Type `#` → dropdown appears → arrow keys navigate → Enter selects
5. ✅ Committed bullet shows dimmed, child bullet stays full brightness
6. ✅ Cannot type in committed bullet, can copy text
7. ✅ Tab/Shift+Tab indent/outdent work at any depth
8. ✅ Parent-child relationships tracked correctly on commit

---

## Known Issues

### None (Critical)
All core functionality working as designed.

### Minor (Cosmetic)
- Autocomplete dropdowns use fixed positioning - may go off-screen on small viewports
- No visual indicator showing current depth while typing (only shows in committed bullets)

---

## Files Modified

**Core Implementation:**
- `/frontend/src/components/BulletEditor.tsx` - Main editor component
- `/frontend/src/lib/mockApi.ts` - Added `searchNotes()` and `searchTags()`
- `/frontend/src/index.css` - Committed bullet styling

**Types:**
- `/frontend/src/types/index.ts` - Bullet, Span, Note interfaces

**Not Used:**
- `/frontend/src/lib/tiptap/committedBullet.ts` - Custom extension not needed
- `/frontend/src/components/CommittedBullet.tsx` - React component not needed

---

## Phase 3 Implementation Details

### 1. Global Search (Cmd+K)
**File:** `/frontend/src/components/SearchModal.tsx`

- Modal overlay with search input
- Live search using `mockApi.search(query)`
- Arrow key navigation, Enter to select
- Displays bullet text with date context
- Escape to close

### 2. Backlinks Panel (Cmd+B)
**File:** `/frontend/src/components/BacklinksPanel.tsx`

- Fixed right sidebar (350px wide)
- Shows bullets containing wikilinks to current note
- Uses `mockApi.getBacklinks(noteDate)`
- Click to navigate (TODO: implement navigation)
- Toggle visibility with Cmd+B

### 3. Master Tasks View (Ctrl+T)
**File:** `/frontend/src/components/TasksModal.tsx`

**Features:**
- Modal overlay with task list
- Status filters: Active (TODO+DOING), All, Done
- Date filters: Today, Week, Month, All Time
- Keyboard navigation: Arrow keys, Spacebar to cycle, Enter to navigate
- Click checkbox to toggle TODO ↔ DONE
- Spacebar cycles: TODO → DOING → DONE → TODO
- Tasks stay visible after status change until modal closes (filter violation persistence)
- Strikethrough styling for completed tasks
- DOING badge for in-progress tasks

**Task Detection:**
- Auto-detects `[]` or `[ ]` at start of bullet text (regex: `/^\[\s*\]/`)
- Creates task annotation with state 'open' on commit
- No `-` dash required (more flexible than markdown checkboxes)

**Task State Management:**
- `mockApi.getTasks()` - Fetch all tasks with annotations
- `mockApi.updateTaskState(bulletId, state)` - Update task status
- Uses latest annotation for current state (append-only)
- `locallyModified` set prevents premature hiding on filter change

---

## Git Workflow

**Branch Strategy:**
- One branch per phase: `phase-N-description`
- Tag on completion: `vX.Y-description`
- Merge to main when tested

**Current State:**
- ✅ Tagged `v0.3-frontend-complete` on main
- 🚧 Working on branch `phase-1-backend-api`

## Next Steps

**Immediate (Phase 1):**
1. Review Phase 1 requirements from implementation plan
2. Choose backend provider (Firebase, Supabase, custom API)
3. Design API contracts matching mockApi interface
4. Implement backend adapter layer
5. Add authentication
6. Test and validate persistence

**Future Phases:**
- **Daily note navigation:** Add date picker and arrow keys to navigate between dates
- **Navigation from search/tasks:** Implement scroll-to-bullet functionality
- **Polish autocomplete:** Better positioning, fuzzy search
- **Annotations API:** Manual task markup UI (deferred from 4.4)

---

## Related Documentation

- **Engineering Spec:** `/Users/jefferyellerbee/projects/jnotes/jnotes_V1.1_mods.md` - Technical specification and architecture
- **Implementation Plan:** `/Users/jefferyellerbee/projects/jnotes/jnotes_V1.1_plan.txt` - Phased development roadmap
- **Project README:** `/Users/jefferyellerbee/projects/jnotes/CLAUDE.md` - Project overview
- **Session History:** This file - Current session progress and implementation details

**Phase 2 Status:** ✅ Complete - All acceptance criteria met plus tag autocomplete bonus feature
**Phase 3 Status:** ✅ Complete - Search, backlinks, and tasks fully functional (skipped 4.4 Annotations API)
