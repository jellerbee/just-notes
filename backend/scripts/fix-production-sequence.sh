#!/bin/bash
# Fix the production database sequence issue
# Run this when you get "Unique constraint failed on the fields: (seq)" errors

# This script requires the DATABASE_URL from your .env file or environment

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable not set"
  echo "Please set it to your Render Postgres connection string"
  exit 1
fi

echo "Fixing appends table sequence..."
psql "$DATABASE_URL" -f "$(dirname "$0")/fix-sequence.sql"

if [ $? -eq 0 ]; then
  echo "✅ Sequence fixed successfully!"
  echo "You should now be able to add bullets without errors."
else
  echo "❌ Failed to fix sequence. Check your DATABASE_URL and database connection."
  exit 1
fi
