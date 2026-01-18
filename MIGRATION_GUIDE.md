/**
 * Manual migration guide for existing mediaUrl → audio80wpm/audio100wpm
 * 
 * This file documents how to migrate existing data.
 * Run the migration script: npx tsx server/migrate-audio.ts
 * 
 * Alternative: SQL migration (if needed)
 * 
 * SQL approach (PostgreSQL):
 * 
 * -- For 100 WPM (titles containing '100', 'fast', etc.)
 * UPDATE content 
 * SET audio_100wpm = media_url
 * WHERE media_url IS NOT NULL 
 * AND (
 *   title ILIKE '%100%' 
 *   OR title ILIKE '%fast%' 
 *   OR title ILIKE '%speed 100%'
 * )
 * AND audio_100wpm IS NULL;
 * 
 * -- For 80 WPM (titles containing '80', 'slow', or everything else)
 * UPDATE content 
 * SET audio_80wpm = media_url
 * WHERE media_url IS NOT NULL 
 * AND (
 *   title ILIKE '%80%' 
 *   OR title ILIKE '%slow%' 
 *   OR title NOT ILIKE '%100%'
 * )
 * AND audio_80wpm IS NULL;
 * 
 * -- Optional: Clear mediaUrl after migration
 * UPDATE content 
 * SET media_url = NULL
 * WHERE audio_80wpm IS NOT NULL OR audio_100wpm IS NOT NULL;
 */

export const migrationGuide = `
MIGRATION GUIDE: mediaUrl → audio80wpm/audio100wpm

Step 1: Run the Node.js migration script
  npx tsx server/migrate-audio.ts

Step 2: Verify the migration
  Check admin dashboard Manage Tests tab to see if audio fields are populated

Step 3: (Optional) Clear mediaUrl
  Edit server/migrate-audio.ts and uncomment the mediaUrl: null line
  Re-run the script

Rollback (if needed):
  The migration preserves mediaUrl, so you can always restore from backup.
`;
