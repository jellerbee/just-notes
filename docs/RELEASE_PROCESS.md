# Release Process

**Current Version:** v1.0.0 (Production Release)
**Release Schedule:** Monthly (1st week of each month)
**Next Scheduled Release:** [To be determined]

---

## Release Strategy

### Monthly Releases (Planned)
- **Frequency:** Once per month (1st week)
- **Purpose:** New features, enhancements, non-critical bug fixes
- **Branch:** `main` → `release/vX.Y.0`
- **Tag:** `vX.Y.0` (e.g., v1.1.0, v1.2.0)

### Hotfixes (Emergency Only)
- **Trigger:** Critical bugs that prevent note-taking
- **Timeline:** Fixed and deployed ASAP (same day if possible)
- **Branch:** `main` → `hotfix/vX.Y.Z`
- **Tag:** `vX.Y.Z` (e.g., v1.0.1, v1.0.2)

---

## Git Workflow

### Branching Strategy

```
main (protected)
├── release/v1.1.0 (monthly release branch)
├── release/v1.2.0
└── hotfix/v1.0.1 (critical bug fix)
```

**Branch Types:**
- `main` - Production-ready code
- `release/vX.Y.0` - Monthly release preparation
- `hotfix/vX.Y.Z` - Emergency critical fixes

---

## Monthly Release Process

### 1. Planning Phase (Week 1 of month)

**Create Release Branch:**
```bash
git checkout main
git pull origin main
git checkout -b release/v1.1.0
git push -u origin release/v1.1.0
```

**Document Planned Features:**
- Create `docs/releases/v1.1.0-planned.md`
- List all planned features and enhancements
- Reference GitHub issues for tracking

### 2. Development Phase (Week 2-3)

**Work on Release Branch:**
```bash
git checkout release/v1.1.0
# Make changes, commit regularly
git add .
git commit -m "feat: description of feature"
git push origin release/v1.1.0
```

**Commit Message Convention:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

### 3. Testing Phase (Week 4)

**Testing Checklist:**
- [ ] All planned features implemented
- [ ] Manual testing on local dev environment
- [ ] Manual testing on Render staging (if available)
- [ ] No console errors
- [ ] All GitHub issues resolved
- [ ] Documentation updated

### 4. Release Phase (End of month)

**Create Release Tag:**
```bash
git checkout release/v1.1.0
git tag -a v1.1.0 -m "Release v1.1.0 - [Brief description]"
git push origin v1.1.0
```

**Merge to Main:**
```bash
git checkout main
git merge release/v1.1.0
git push origin main
```

**Create Release Notes:**
```bash
# Create docs/releases/v1.1.0-release-notes.md
# Document:
# - New features
# - Bug fixes
# - Breaking changes (if any)
# - Upgrade instructions (if needed)
```

**GitHub Release:**
```bash
gh release create v1.1.0 \
  --title "v1.1.0 - [Release Name]" \
  --notes-file docs/releases/v1.1.0-release-notes.md
```

**Cleanup:**
```bash
# Optional: Delete remote release branch after merge
git push origin --delete release/v1.1.0
git branch -d release/v1.1.0
```

---

## Hotfix Process (Critical Bugs Only)

### What Qualifies as a Hotfix?

**Critical Issues:**
- ✅ Cannot create or commit bullets
- ✅ Data loss or corruption
- ✅ App crashes or becomes unusable
- ✅ Authentication/access issues

**NOT Critical (Wait for monthly release):**
- ❌ UI polish or styling issues
- ❌ Feature enhancements
- ❌ Performance optimizations (unless severe)
- ❌ Nice-to-have improvements

### Hotfix Workflow

**1. Create Hotfix Branch:**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/v1.0.1
```

**2. Fix the Critical Bug:**
```bash
# Make minimal changes - only fix the critical issue
git add .
git commit -m "fix: [critical bug description] (#issue-number)"
git push -u origin hotfix/v1.0.1
```

**3. Test Locally:**
```bash
# Backend
cd backend && npm run build && npm test

# Frontend
cd frontend && npm run build
# Test manually in browser
```

**4. Tag and Merge:**
```bash
# Tag the hotfix
git tag -a v1.0.1 -m "Hotfix v1.0.1 - [Brief description]"
git push origin v1.0.1

# Merge to main
git checkout main
git merge hotfix/v1.0.1
git push origin main

# Cleanup
git push origin --delete hotfix/v1.0.1
git branch -d hotfix/v1.0.1
```

**5. Deploy:**
- Render auto-deploys from `main`
- Monitor deployment logs
- Verify fix in production

---

## Version Numbering (Semantic Versioning)

**Format:** `vMAJOR.MINOR.PATCH`

- **MAJOR** (v2.0.0): Breaking changes, major architecture changes
- **MINOR** (v1.1.0): New features, enhancements (monthly releases)
- **PATCH** (v1.0.1): Bug fixes, hotfixes

**Examples:**
- `v1.0.0` - Initial production release
- `v1.0.1` - Hotfix for critical bug
- `v1.1.0` - November monthly release with new features
- `v1.2.0` - December monthly release
- `v2.0.0` - Major rewrite or breaking changes

---

## Issue Tracking

### GitHub Issue Labels

**Priority:**
- `P0-critical` - Hotfix required (blocks note-taking)
- `P1-high` - Include in next monthly release
- `P2-medium` - Future release
- `P3-low` - Nice to have

**Type:**
- `bug` - Something broken
- `enhancement` - New feature or improvement
- `documentation` - Docs updates
- `question` - User question or discussion

**Status:**
- `planned` - Scheduled for upcoming release
- `in-progress` - Currently being worked on
- `blocked` - Waiting on something
- `wontfix` - Won't implement

### Issue Workflow

**New Issue:**
1. Triage and assign priority label
2. Add to milestone (e.g., "v1.1.0 - November Release")
3. If P0-critical: Create hotfix immediately
4. If P1-high: Add to next monthly release
5. Otherwise: Backlog for future releases

---

## Release Documentation

### Required Files

**Before Release:**
- `docs/releases/vX.Y.0-planned.md` - What's planned for this release

**After Release:**
- `docs/releases/vX.Y.0-release-notes.md` - What was actually released

**Template: `docs/releases/vX.Y.0-planned.md`**
```markdown
# v1.1.0 - Planned Features

**Target Release Date:** November 7, 2024
**Milestone:** [v1.1.0 Milestone](link-to-github-milestone)

## Planned Features

### New Features
- [ ] #XX - Feature description
- [ ] #XX - Feature description

### Enhancements
- [ ] #XX - Enhancement description

### Bug Fixes
- [ ] #XX - Bug description

## Out of Scope
- Deferred to future releases
```

**Template: `docs/releases/vX.Y.0-release-notes.md`**
```markdown
# Release Notes - v1.1.0

**Release Date:** November 7, 2024
**Type:** Monthly Release

## What's New

### ✨ New Features
- **Feature Name** (#XX) - Description of what it does

### 🔧 Enhancements
- **Enhancement Name** (#XX) - Description

### 🐛 Bug Fixes
- **Bug Description** (#XX) - What was fixed

### 📚 Documentation
- Updated XYZ documentation

## Upgrade Instructions

No special steps required - Render auto-deploys from main.

## Breaking Changes

None

## Known Issues

None

---

**Full Changelog:** https://github.com/jellerbee/just-notes/compare/v1.0.0...v1.1.0
```

---

## Release Checklist

### Monthly Release Checklist

**Planning:**
- [ ] Create release branch (`release/vX.Y.0`)
- [ ] Create planned features document
- [ ] Create GitHub milestone
- [ ] Assign issues to milestone

**Development:**
- [ ] Implement all planned features
- [ ] Write tests (if applicable)
- [ ] Update documentation
- [ ] Update `CHANGELOG.md`

**Testing:**
- [ ] Test locally (frontend + backend)
- [ ] Test on Render (staging if available)
- [ ] Verify all issues resolved
- [ ] No console errors
- [ ] Manual smoke test of core features

**Release:**
- [ ] Create release notes document
- [ ] Tag release (`vX.Y.0`)
- [ ] Merge to main
- [ ] Create GitHub release
- [ ] Verify Render deployment
- [ ] Close milestone
- [ ] Announce in commit message

**Cleanup:**
- [ ] Delete release branch (optional)
- [ ] Archive release documents
- [ ] Plan next release

### Hotfix Checklist

- [ ] Verify issue is P0-critical
- [ ] Create hotfix branch (`hotfix/vX.Y.Z`)
- [ ] Fix ONLY the critical issue (minimal changes)
- [ ] Test locally
- [ ] Tag hotfix (`vX.Y.Z`)
- [ ] Merge to main
- [ ] Verify Render deployment
- [ ] Close issue
- [ ] Document in `CHANGELOG.md`

---

## Current Version History

### v1.0.0 - October 9, 2024 (Production Release)
- Initial production release
- All Phase 1-6 features complete
- 10 critical bugs fixed in final polish session

---

## Quick Reference

**Create Monthly Release:**
```bash
git checkout -b release/v1.1.0
# ... develop features ...
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
git checkout main && git merge release/v1.1.0 && git push
```

**Create Hotfix:**
```bash
git checkout -b hotfix/v1.0.1
# ... fix critical bug ...
git tag -a v1.0.1 -m "Hotfix v1.0.1"
git push origin v1.0.1
git checkout main && git merge hotfix/v1.0.1 && git push
```

**Check Current Version:**
```bash
git describe --tags --abbrev=0
```

**List All Releases:**
```bash
git tag -l
```

---

## Notes

- Render auto-deploys from `main` branch
- No manual deployment steps required
- Browser cache may require hard refresh (Ctrl+Shift+R)
- Production URL: https://jnotes-frontend.onrender.com
- API URL: https://jnotes-api.onrender.com

---

**Last Updated:** October 9, 2024
**Maintained By:** Project Team
