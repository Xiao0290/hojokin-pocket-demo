-- Add object-storage metadata required for Closed Beta export retention and signed URLs.

ALTER TABLE exported_files
  ADD COLUMN IF NOT EXISTS filename TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS checksum TEXT;

CREATE INDEX IF NOT EXISTS idx_exports_storage_key ON exported_files(storage_key);
