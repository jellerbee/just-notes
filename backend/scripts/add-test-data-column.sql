-- Add test_data flag to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS test_data BOOLEAN DEFAULT false;

-- Update existing notes to mark them as non-test data
UPDATE notes SET test_data = false WHERE test_data IS NULL;
