/**
 * Re-score High Court Typing attempts that contain the old synthetic
 * "formatting" error entry. The current scorer treats text as the score source;
 * visual style differences do not create word mistakes.
 *
 * Defaults to a dry run. To write, provide --apply and an explicit target:
 *   npx tsx server/scripts/recalculate-high-court-formatting.ts --production --apply
 *
 * Production mode must be run inside the deployed runtime so the configured
 * DATABASE_URL points to production.
 */

import { and, eq, ilike } from "drizzle-orm";
import { db } from "../db";
import { highCourtAttempts } from "../../shared/schema";
import { scoreHighCourtTest } from "../highCourtScorer";

async function recalculateAffectedAttempts() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes("--apply");
  const targetIsProduction = args.includes("--production");
  const targetIsDevelopment = args.includes("--development");

  if (targetIsProduction && targetIsDevelopment) {
    throw new Error("Choose only one target: --production or --development.");
  }
  if (applyChanges && !targetIsProduction && !targetIsDevelopment) {
    throw new Error("Writes require an explicit --production or --development target.");
  }
  if (targetIsProduction && process.env.NODE_ENV !== "production") {
    throw new Error("--production must be run from the deployed production runtime.");
  }
  if (targetIsDevelopment && process.env.NODE_ENV === "production") {
    throw new Error("--development cannot be used from a production runtime.");
  }

  console.log(
    `High Court formatting backfill: ${applyChanges ? "APPLY" : "DRY RUN"}` +
      (targetIsProduction ? " [target: production]" : targetIsDevelopment ? " [target: development]" : "")
  );

  const affectedAttempts = await db
    .select()
    .from(highCourtAttempts)
    .where(
      and(
        eq(highCourtAttempts.type, "typing"),
        ilike(highCourtAttempts.alignmentData, "%bold/italic/underline formatting difference%"),
      ),
    );

  let updated = 0;
  let failed = 0;

  console.log(`Found ${affectedAttempts.length} affected High Court Typing attempts.`);

  for (const attempt of affectedAttempts) {
    try {
      const scoring = scoreHighCourtTest("typing", attempt.originalText, attempt.typedText);

      if (applyChanges) {
        await db
          .update(highCourtAttempts)
          .set({
            fullMistakes: scoring.fullMistakes,
            halfMistakes: scoring.halfMistakes,
            marks: String(scoring.marks),
            alignmentData: scoring.alignmentData,
          })
          .where(eq(highCourtAttempts.id, attempt.id));
      }

      console.log(
        `  ${applyChanges ? "Updated" : "Would update"} attempt ${attempt.id}: ` +
          `${attempt.fullMistakes} → ${scoring.fullMistakes} full mistakes, ` +
          `${attempt.marks} → ${scoring.marks} marks`,
      );
      updated++;
    } catch (error) {
      console.error(`  Failed attempt ${attempt.id}:`, error);
      failed++;
    }
  }

  console.log(`${applyChanges ? "Updated" : "Would update"}: ${updated}; failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

recalculateAffectedAttempts().catch((error) => {
  console.error("High Court formatting backfill failed:", error);
  process.exit(1);
});
