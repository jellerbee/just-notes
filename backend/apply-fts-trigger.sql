-- FTS Trigger Function
CREATE OR REPLACE FUNCTION bullets_fts_trigger() RETURNS trigger AS $$
BEGIN
  NEW.text_tsv := to_tsvector('english', COALESCE(NEW.text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS bullets_fts_update ON bullets;

-- FTS Trigger on INSERT and UPDATE
CREATE TRIGGER bullets_fts_update
  BEFORE INSERT OR UPDATE OF text
  ON bullets
  FOR EACH ROW
  EXECUTE FUNCTION bullets_fts_trigger();

-- Update existing bullets to populate text_tsv
UPDATE bullets SET text_tsv = to_tsvector('english', COALESCE(text, ''));
