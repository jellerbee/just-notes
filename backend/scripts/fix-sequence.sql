-- Fix the appends sequence to start from the max existing seq
SELECT setval(
  pg_get_serial_sequence('appends', 'seq'),
  (SELECT COALESCE(MAX(seq), 0) + 1 FROM appends),
  false
);
