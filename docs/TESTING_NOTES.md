# Testing Notes

Issues discovered during production testing on Render.com.

## Phase 5 - Deployment Testing (2025-10-05)

### Issue 1: Failed commits leave ghost bullets in DOM

**Severity:** Medium
**Status:** ✅ Fixed
**Date Found:** 2025-10-05
**Date Fixed:** 2025-10-07

**Description:**
When a bullet commit fails (e.g., due to backend errors), the frontend optimistically marks the bullet as committed in the DOM (`data-committed="true"`) but doesn't roll back this state when the backend returns an error.

**Steps to Reproduce:**
1. Attempt to commit a bullet that will fail on backend (e.g., sequence error)
2. See error banner appear
3. Without refreshing, try to create a child bullet under the failed bullet
4. The child will try to use the failed bullet's ID as `parentId`
5. Backend rejects with foreign key constraint error

**Root Cause:**
- Optimistic UI updates DOM immediately with committed state
- Error handling shows retry banner but doesn't clean up DOM
- Ghost bullet remains in DOM with `data-committed="true"`
- Subsequent bullets find the ghost when calculating `parentId`

**Fix:**
Added rollback logic in the error handler that:
1. Finds the failed bullet by its `bulletId` in the DOM
2. Removes the `data-committed`, `data-bullet-id`, and `style` attributes
3. Clears the `lastCommittedIdRef` if it was set to this bulletId
4. Restores the bullet to uncommitted state so user can edit and retry

This ensures that failed commits don't leave ghost bullets in the DOM that could cause foreign key errors for subsequent child bullets.

**Expected Behavior:**
When commit fails, the bullet should have `data-committed` flag removed and be reverted to uncommitted state so the user can edit or retry.

**Fix Location:**
`frontend/src/components/BulletEditor.tsx:459-498` - Added rollback logic in catch block to remove committed attributes from failed bullet.

---

### Issue 2: Wikilinks do not navigate to the note when clicked.

**Severity:** Medium
**Status:** ✅ Fixed
**Date Found:** 2025-10-06
**Date Fixed:** 2025-10-07

**Description:**
When attempting to open a wikilink by clicking on the link with a mouse, or by placing the cursor within the text with arrow keys and then pressing enter, the referenced note is not opened.  At the same time the UI attempts to create a new instance of the same wikilink.  What results is the original link + some portion of the original link again.

**Steps to Reproduce:**
1. In a fresh uncommited top level bullet create a new wikilink by typing '[[wikilink-A]]' and hit <enter> twice to complete the link creation and to commit the bullet.
2. Attempt to open the newly created link (by mouse click, or navigation and hitting enter).
3. Observe that the referenced note is not opened and that a new, but truncated, link was created.
5. The new link is a shortened version of the original link depending on where in the original link the cursor was placed when you tried to open it.  Basically the new link will always be shorter than the original link by the number of characters from the opening brace '[[' + 2.  For example if the cursor is placed: [[w<cursor here>ikilink-A]] then the result will be '[[wikilink-A]] ikilink-A]]'


**Root Cause:**
Wikilinks were being rendered as plain text in the editor, not as clickable links. When clicking on them or navigating with cursor, Tiptap treated them as regular text and triggered the autocomplete (because it detected `[[`).

**Fix:**
1. Created custom Tiptap `Wikilink` mark extension (`frontend/src/extensions/Wikilink.ts`)
2. Updated `BulletEditor` to use the Wikilink extension
3. Added click handler to detect wikilink clicks and navigate to target note
4. Updated `loadBullets` to parse `[[target]]` syntax and wrap in wikilink spans
5. Added logic to prevent autocomplete from triggering when cursor is inside existing wikilink
6. Updated CSS to style wikilinks as blue, underlined on hover
7. Added `onNavigateToNote` prop to BulletEditor and connected to App's `navigateToNote`

**Expected Behavior:**
Clicking a wikilink, once created, should always open the note with the same name as the link.

**Fix Location:**
- `frontend/src/extensions/Wikilink.ts` - New Tiptap extension
- `frontend/src/components/BulletEditor.tsx:8` - Import Wikilink extension
- `frontend/src/components/BulletEditor.tsx:21` - Added onNavigateToNote prop
- `frontend/src/components/BulletEditor.tsx:98-102` - Configure Wikilink extension
- `frontend/src/components/BulletEditor.tsx:524-529` - Helper to convert text to HTML with wikilinks
- `frontend/src/components/BulletEditor.tsx:587-596` - Prevent autocomplete in existing wikilinks
- `frontend/src/components/BulletEditor.tsx:759-781` - Click handler for wikilink navigation
- `frontend/src/App.tsx:104` - Pass onNavigateToNote to BulletEditor
- `frontend/src/index.css:102-112, 129-132` - CSS styling for wikilinks

---

### Issue 3: Backlinks have not been implemented.

**Severity:** Medium
**Status:** ✅ Already Implemented (Not a Bug)
**Date Found:** 2025-10-06
**Date Resolved:** 2025-10-07

**Description:**
We have not implemented the backlinks panel doc/jnotes_impl_plan.md phase 3, item #2

**Resolution:**
This was not a bug. The backlinks panel was already implemented in Phase 3 and is fully functional. The keyboard shortcut to open it is **Cmd+B** (Mac) or **Ctrl+B** (Windows/Linux).

**Implementation Location:**
- Component: `frontend/src/components/BacklinksPanel.tsx`
- Keyboard handler: `frontend/src/App.tsx:76-80`
- API endpoint: `GET /search/backlinks?target=NoteName`
- Backend route: `backend/src/routes/search.ts`

**How to Use:**
1. Press **Cmd+B** (Mac) or **Ctrl+B** (Windows/Linux) to toggle the backlinks panel
2. The panel shows all bullets that reference the current note via wikilinks
3. Click on any backlink to navigate to that note

---


## Performance Testing Results

### Full-Text Search (FTS)
- **Test Dataset:** 4,000 bullets across 30 daily notes
- **Result:** ✅ Super fast response times
- **Tested via:** curl to `/search?q=<term>` endpoint

### Database Configuration
- **Plan:** Render.com Basic-1GB PostgreSQL
- **Performance:** Adequate for test data generation, slower on bulk inserts
