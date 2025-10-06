# Testing Notes

Issues discovered during production testing on Render.com.

## Phase 5 - Deployment Testing (2025-10-05)

### Issue 1: Failed commits leave ghost bullets in DOM

**Severity:** Medium
**Status:** Not fixed
**Date Found:** 2025-10-05

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

**Expected Behavior:**
When commit fails, the bullet should either:
1. Be removed from DOM entirely, OR
2. Have `data-committed` flag removed and be reverted to uncommitted state

**Workaround:**
Refresh the page to clear stale DOM state and reload only bullets that exist in database.

**Fix Location:**
`frontend/src/components/BulletEditor.tsx` - Error handling in commit function needs to roll back optimistic DOM changes.

---



## Performance Testing Results

### Full-Text Search (FTS)
- **Test Dataset:** 4,000 bullets across 30 daily notes
- **Result:** ✅ Super fast response times
- **Tested via:** curl to `/search?q=<term>` endpoint

### Database Configuration
- **Plan:** Render.com Basic-1GB PostgreSQL
- **Performance:** Adequate for test data generation, slower on bulk inserts
