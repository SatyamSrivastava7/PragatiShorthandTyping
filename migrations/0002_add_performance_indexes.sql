-- Migration to add performance indexes for cost optimization
-- Run with: npm run migrate

-- Results table indexes (frequently queried)
CREATE INDEX IF NOT EXISTS idx_results_student_id_submitted_at 
  ON results(student_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_content_id 
  ON results(content_id);

CREATE INDEX IF NOT EXISTS idx_results_student_id_content_type 
  ON results(student_id, content_type);

-- Content table indexes (frequently filtered)
CREATE INDEX IF NOT EXISTS idx_content_folder_id_is_enabled 
  ON content(folder_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_content_type_is_enabled 
  ON content(type, is_enabled);

CREATE INDEX IF NOT EXISTS idx_content_date_for 
  ON content(date_for);

-- Users table (for lookups)
CREATE INDEX IF NOT EXISTS idx_users_batch 
  ON users(batch);

CREATE INDEX IF NOT EXISTS idx_users_student_id 
  ON users(student_id);

-- PDF table indexes
CREATE INDEX IF NOT EXISTS idx_pdf_resources_folder_id 
  ON pdf_resources(folder_id);

-- Test Folders indexes
CREATE INDEX IF NOT EXISTS idx_test_folders_language_type 
  ON test_folders(language, type);
