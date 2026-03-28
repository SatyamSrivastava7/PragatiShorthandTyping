-- Add new fields for proper HTML and clean text separation
-- originalTextClean: original text without HTML for metrics calculation
-- typedTextClean: typed text without HTML or PARA_TOKENs for metrics calculation

ALTER TABLE results ADD COLUMN IF NOT EXISTS original_text_clean TEXT;
ALTER TABLE results ADD COLUMN IF NOT EXISTS typed_text_clean TEXT;

-- Function to strip HTML tags
CREATE OR REPLACE FUNCTION strip_html(input TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove HTML tags
  RETURN REGEXP_REPLACE(
    -- Remove HTML entities
    REGEXP_REPLACE(
      -- Remove PARA_TOKEN
      REGEXP_REPLACE(input, '\[\[PARA\]\]', ' ', 'g'),
      '<[^>]+>',
      '',
      'g'
    ),
    '&nbsp;|&lt;|&gt;|&amp;|&quot;|&#39;|&apos;',
    ' ',
    'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate clean text columns by stripping HTML from existing data
UPDATE results 
SET 
  original_text_clean = TRIM(REGEXP_REPLACE(strip_html(original_text), '\s+', ' ', 'g')),
  typed_text_clean = TRIM(REGEXP_REPLACE(strip_html(typed_text), '\s+', ' ', 'g'))
WHERE original_text_clean IS NULL OR typed_text_clean IS NULL;

-- Create index for clean text searches if needed
CREATE INDEX IF NOT EXISTS idx_results_typed_text_clean ON results(typed_text_clean);

-- Regenerate metrics for first 50 typing results based on clean text
-- For typing tests: word count = number of words typed, mistakes based on alignment
WITH typing_results AS (
  SELECT id, original_text_clean, typed_text_clean, time 
  FROM results 
  WHERE content_type = 'typing' AND original_text_clean IS NOT NULL AND typed_text_clean IS NOT NULL
  ORDER BY submitted_at ASC
  LIMIT 50
)
UPDATE results r
SET 
  words = (
    SELECT ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(typing_results.typed_text_clean, '\s+', ' ', 'g')), ' '), 1)
    FROM typing_results WHERE typing_results.id = r.id
  )
FROM typing_results
WHERE r.id = typing_results.id;

-- Regenerate metrics for first 50 shorthand results based on clean text
-- For shorthand tests: word count = original full text word count, base mistakes calculation
WITH shorthand_results AS (
  SELECT id, original_text_clean, typed_text_clean, time 
  FROM results 
  WHERE content_type = 'shorthand' AND original_text_clean IS NOT NULL AND typed_text_clean IS NOT NULL
  ORDER BY submitted_at ASC
  LIMIT 50
)
UPDATE results r
SET 
  words = (
    SELECT ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(shorthand_results.original_text_clean, '\s+', ' ', 'g')), ' '), 1)
    FROM shorthand_results WHERE shorthand_results.id = r.id
  )
FROM shorthand_results
WHERE r.id = shorthand_results.id;

-- Regenerate metrics for first 50 pitman results based on clean text
-- For pitman tests: word count = number of words typed (same as typing)
WITH pitman_results AS (
  SELECT id, original_text_clean, typed_text_clean, time 
  FROM results 
  WHERE content_type = 'pitman' AND original_text_clean IS NOT NULL AND typed_text_clean IS NOT NULL
  ORDER BY submitted_at ASC
  LIMIT 50
)
UPDATE results r
SET 
  words = (
    SELECT ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(pitman_results.typed_text_clean, '\s+', ' ', 'g')), ' '), 1)
    FROM pitman_results WHERE pitman_results.id = r.id
  )
FROM pitman_results
WHERE r.id = pitman_results.id;