# jnotes Backend API

Append-only REST API for jnotes with Postgres storage.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally or accessible via connection string

### Installation

```bash
# Install dependencies
npm install

# Set up database connection
cp .env.example .env
# Edit .env and update DATABASE_URL with your Postgres connection string

# Run migrations (creates tables and FTS triggers)
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### Development

```bash
# Start dev server with auto-reload
npm run dev
```

Server runs on `http://localhost:3000` by default.

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Database Setup

The migration script (`prisma/migrations/init.sql`) includes:

- **Append log** (`appends`) - Source of truth
- **Materialized tables** (`notes`, `bullets`, `annotations`, `links`)
- **Full-text search** - Postgres tsvector with GIN index
- **Automatic FTS updates** - Trigger on bullet insert/update

## API Endpoints

### Notes

- `POST /notes/:date/ensure` - Create daily note if missing
- `GET /notes/:noteId` - Get bullets for note (with `?sinceSeq=X` support)

### Bullets

- `POST /notes/:noteId/bullets/append` - Append single bullet
- `POST /notes/:noteId/bullets/appendBatch` - Bulk append (for migration)

### Annotations

- `POST /annotations/append` - Add task/entity/label annotation

### Redaction

- `POST /redact` - Soft delete bullet

### Search

- `GET /search?q=query` - Full-text search across bullets
- `GET /backlinks?target=NoteName` - Find bullets linking to target

## Architecture

- **Express** - REST API framework
- **Prisma** - Type-safe ORM for Postgres
- **Postgres** - Append log + materialized views + FTS
- **TypeScript** - Shared types with frontend

See `docs/jnotes_eng_spec.md` for detailed architecture.
