-- Add processing progress column to patch_notes
ALTER TABLE patch_notes 
ADD COLUMN processing_progress INTEGER CHECK (processing_progress >= 0 AND processing_progress <= 100);

-- Add index for querying by progress
CREATE INDEX idx_patch_notes_processing_progress ON patch_notes(processing_progress) WHERE processing_progress IS NOT NULL;

