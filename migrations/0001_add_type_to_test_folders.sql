-- Add type column to test_folders table
ALTER TABLE test_folders 
ADD COLUMN type varchar(20) NOT NULL DEFAULT 'typing';

-- Create an index on type for faster filtering
CREATE INDEX idx_test_folders_type ON test_folders(type);
