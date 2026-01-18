/**
 * Migration script to move existing mediaUrl to audio80wpm or audio100wpm
 * Based on content title patterns
 * 
 * Usage: npx tsx server/migrate-audio.ts
 */

import { db } from './db';
import { content } from '@shared/schema';
import { eq, isNotNull } from 'drizzle-orm';

async function migrateAudio() {
  console.log('Starting audio migration...');

  try {
    // Get all content with mediaUrl
    const contentsWithMedia = await db
      .select()
      .from(content)
      .where(isNotNull(content.mediaUrl));

    console.log(`Found ${contentsWithMedia.length} content items with mediaUrl`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const item of contentsWithMedia) {
      // Skip if already migrated (has audio80wpm or audio100wpm)
      if (item.audio80wpm || item.audio100wpm) {
        console.log(`⏭️  Skipping "${item.title}" - already has audio variant`);
        skippedCount++;
        continue;
      }

      // Determine audio speed based on title
      const titleLower = item.title.toLowerCase();
      let targetAudioField: 'audio80wpm' | 'audio100wpm' = 'audio80wpm'; // default

      // Check if title suggests 100 WPM
      if (
        titleLower.includes('100') ||
        titleLower.includes('fast') ||
        titleLower.includes('speed 100') ||
        titleLower.includes('wpm 100')
      ) {
        targetAudioField = 'audio100wpm';
      }
      // Check if title explicitly says 80 WPM
      else if (
        titleLower.includes('80') ||
        titleLower.includes('slow') ||
        titleLower.includes('speed 80') ||
        titleLower.includes('wpm 80') ||
        !titleLower.includes('100')
      ) {
        targetAudioField = 'audio80wpm';
      }

      // Update the content item
      await db
        .update(content)
        .set({
          [targetAudioField]: item.mediaUrl,
          // Uncomment below to clear mediaUrl after migration
          // mediaUrl: null,
        })
        .where(eq(content.id, item.id));

      console.log(
        `✅ Migrated "${item.title}" → ${targetAudioField}`
      );
      migratedCount++;
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   Total: ${contentsWithMedia.length}`);

    console.log(
      '\n⚠️  Note: mediaUrl still contains the original audio. To clear it, uncomment the line in the script.'
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateAudio().then(() => {
  console.log('\n✨ Migration completed!');
  process.exit(0);
});
