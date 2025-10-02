# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a notes MVP application built with Electron + React + TypeScript. It creates a local desktop app for taking notes with outliner functionality, task management, and file-based storage. The app automatically creates daily notes and saves them as Markdown files while maintaining a SQLite index for search and backlinks.

## Architecture

**Dual Frontend Architecture:**
- **React Frontend** (`src/renderer/`): Built with Vite, intended for rich editor using Tiptap (currently not working due to ES module issues in Electron)
- **Simple HTML Frontend** (`simple.html`): Currently active frontend - vanilla HTML/CSS/JS that provides all core functionality

**Backend (Electron Main Process):**
- **File Operations** (`src/main/fs.ts`): Handles vault creation, daily note generation, file read/write
- **Database Layer** (`src/main/db.ts`): SQLite connection management with full foreign key support
- **Indexer** (`src/main/indexer.ts`): Parses Markdown → database entries for search/links/tasks
- **IPC Handlers** (`src/main/index.ts`): Bridges frontend to file system operations

**Data Model:**
- **Files as Truth**: Markdown files in `~/Documents/NotesVault/YYYY-MM-DD.md` format
- **SQLite Index**: Structured data (notes, blocks, links, tags, tasks) with FTS5 search (disabled)
- **Task Syntax**: `- [ ]` (TODO) → `- [ ] (Doing)` (DOING) → `- [x]` (DONE)

## Build Commands

```bash
# Development
npm run dev                    # Start Vite dev server (React - not currently working)
npm run electron:dev          # Concurrent Vite + Electron dev mode

# Production
npm run build                 # Build React + compile main process TypeScript
npm run build:main           # Compile only main process TypeScript
npm start                    # Build and run Electron app

# Currently Active Frontend
# The app loads simple.html directly, not the React build
```

## Key Implementation Details

**Current Working State (Updated 2025-10-02):**
- App loads `simple.html` as the main interface - fully functional notes app
- SQLite database operations are working properly with all foreign key constraints resolved
- File operations work correctly for daily note creation and saving
- All core functionality works: outliner, tasks, auto-save, search, wikilink navigation
- ID markers are hidden from user view but preserved in files for database consistency
- **Master Tasks View** (`tasks.html`) - Fully functional keyboard-first task management interface

**Task Management:**
- Uses standard Markdown checkbox syntax with custom (Doing) modifier
- **Editor**: Cmd/Ctrl+Enter cycles task states in the editor
- **Master Tasks View**: Keyboard-first interface with:
  - Spacebar to cycle task status: TODO → DOING → DONE → TODO
  - Arrow keys for navigation with prominent visual selection
  - Click checkbox to toggle TODO/DOING ↔ DONE
  - Auto-focus and immediate keyboard functionality
  - Task-first architecture showing stable chronological order
- Parser in `src/renderer/lib/markdown/parse.ts` extracts tasks from checkbox syntax

**File Structure Issues:**
- React builds to `/dist/` but ES modules don't load properly in Electron
- `simple.html` provides working fallback with identical functionality
- TypeScript compilation targets ES2020 with separate configs for main/renderer

**SQLite Integration:**
- Database schema defined in `sqlite/schema.sql` with FTS5 search tables
- Indexer parses Markdown bullets into hierarchical block structure with proper transaction sequencing
- Search functionality working with LIKE fallback queries
- Links, tags, and tasks are properly stored with correct foreign key relationships
- Backlinks infrastructure complete and functional

## Development Notes

**Module System:**
- Main process uses ES modules (`"type": "module"` in package.json)
- Vite builds React as IIFE format for Electron compatibility
- TypeScript configs: `tsconfig.json` (renderer), `tsconfig.main.json` (main process)

**Debugging:**
- App opens with dev tools automatically for debugging
- Console logging throughout for tracing file operations and errors
- All SQLite operations stable and working correctly

**Task Parsing:**
- Regex patterns in parse.ts handle checkbox detection and task state extraction
- Hidden UUID markers (`<!-- {id: uuid} -->`) for stable block identification
- Hierarchical block relationships based on indentation (2 spaces per level)

## Current Feature Status

**✅ Fully Working Features:**
1. **Daily Note Creation** - Auto-creates `YYYY-MM-DD.md` files on startup
2. **Task Management** - Cmd/Ctrl+Enter cycles: `[ ]` → `[ ] (Doing)` → `[x]` → `[ ]`
3. **Outliner** - Tab/Shift+Tab for indent/outdent (2 spaces per level)
4. **Wikilink Navigation** - Ctrl+Click `[[links]]` creates/navigates to notes
5. **Auto-save** - Files save 1 second after editing stops
6. **Search** - Full-text search across all bullet point content
7. **Clean UI** - ID markers hidden from editor display but preserved in files
8. **Backlinks** - UI and backend complete, wikilinks properly indexed and stored
9. **Tag Indexing** - Parser extracts `#tags` and stores them correctly in database
10. **Master Tasks View** - Keyboard-first task management across all notes with:
    - Stable chronological ordering (never reorders based on status)
    - Visual selection indicators and auto-selection
    - Spacebar/click status cycling and arrow key navigation
    - Filter by status (TODO, DOING, DONE) with date ranges

**🔮 Future Enhancements (Post-MVP):**
1. **Tag-based Search** - Search and filter by `#tags` (infrastructure exists)
2. **FTS5 Full-Text Search** - Currently using LIKE fallback, FTS5 table ready
3. **AI Integration** - Automatic task detection, entity extraction, daily digest
4. **Enhanced Wikilink Intelligence** - Auto-suggest based on content analysis

## Known Issues & Next Steps

**Debugging Notes:**
- Multiple Electron instances can cause database lock conflicts - use `pkill -f "notes-mvp"` to clean up

**Recent Changes (2025-10-02):**
- All core features stable and tested
- Application in production use for workflow validation
- Database operations fully reliable with proper foreign key handling

**Previous Changes (2025-09-29):**
- **FIXED: SQLite Foreign Key Constraints** - Rewrote indexer transaction logic in `src/main/indexer.ts`
  - Implemented proper async operation sequencing: deletions → blocks → links/tags/tasks
  - All database operations now use Promise-wrapped callbacks for reliable ordering
  - Links, tags, and tasks are successfully stored with correct foreign key relationships
  - Backlinks and tag indexing now fully functional
- **IMPLEMENTED: Master Tasks View** - Created `tasks.html` with keyboard-first interface
  - Fixed task list order stability (SQL changed from status-based to chronological ordering)
  - Implemented proper keyboard navigation with visual selection preservation
  - Added auto-focus, prominent selection highlighting, and immediate keyboard functionality
  - Task status cycling via spacebar and checkbox clicking

**Earlier Changes (2025-09-28):**
- Fixed link extraction in parser to happen before text processing
- Added backlinks IPC handler and UI components
- Implemented ID marker hiding in frontend display
- Simplified search to use reliable LIKE queries as fallback

## Development Workflow

**Current Development Status:**
- Core MVP is functionally complete and ready for real-world testing
- User planning to use for 1 week to validate workflow and identify friction points
- Future development will be driven by actual usage patterns and needs

**Development Commands:**
```bash
npm start              # Development build and run (recommended)
pkill -f "notes-mvp"   # Clean up hung processes if needed
```