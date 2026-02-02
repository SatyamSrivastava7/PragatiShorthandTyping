import { db } from "./db";
import { testFolders, content } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Migration script to populate folder types based on the content within them
 * Run: npx ts-node server/migrate-folder-types.ts
 */
async function migrateFolderTypes() {
  try {
    console.log("Starting folder type migration...");

    // Get all folders
    const allFolders = await db.select().from(testFolders);
    console.log(`Found ${allFolders.length} folders to process`);

    let updated = 0;

    for (const folder of allFolders) {
      // Get the first content item in this folder to determine its type
      const folderContent = await db
        .select({ type: content.type })
        .from(content)
        .where(eq(content.folderId, folder.id))
        .limit(1);

      if (folderContent.length > 0) {
        const contentType = folderContent[0].type;
        
        // Update folder type if it differs
        if (folder.type !== contentType) {
          await db
            .update(testFolders)
            .set({ type: contentType })
            .where(eq(testFolders.id, folder.id));
          
          console.log(`✓ Updated folder ${folder.id} (${folder.name}) to type: ${contentType}`);
          updated++;
        } else {
          console.log(`✓ Folder ${folder.id} (${folder.name}) already has correct type: ${contentType}`);
        }
      } else {
        // Folder has no content, keep default type
        console.log(`○ Folder ${folder.id} (${folder.name}) has no content, keeping default type: ${folder.type}`);
      }
    }

    console.log(`\n✓ Migration complete! Updated ${updated} folders.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateFolderTypes();
