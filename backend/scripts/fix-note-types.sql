-- Fix note types for existing notes
-- Named notes should have noteType='named', daily notes should have noteType='daily'

-- Update notes with titles (named notes) to have noteType='named'
UPDATE notes
SET note_type = 'named'
WHERE title IS NOT NULL;

-- Update notes with dates (daily notes) to have noteType='daily'
UPDATE notes
SET note_type = 'daily'
WHERE date IS NOT NULL;

-- Verify the changes
SELECT
  note_type,
  COUNT(*) as count
FROM notes
GROUP BY note_type;
