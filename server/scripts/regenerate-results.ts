/**
 * Script to regenerate metrics for the latest 50 results
 * Run with: npx tsx server/scripts/regenerate-results.ts
 */

import { db } from "../db";
import { results } from "../../shared/schema";
import { desc, eq } from "drizzle-orm";

const SPLIT_CHAR_PATTERN = /[-–—\/\\:;|+&_~]/;

function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'")
    .toLowerCase();
}

type AlignmentStatus = "match" | "substitution" | "missing" | "extra";

interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

function alignWordsDP(originalWords: string[], typedWords: string[]): AlignmentEntry[] {
  const n = originalWords.length;
  const m = typedWords.length;

  const normalizedOriginal = originalWords.map(normalizeForComparison);
  const normalizedTyped = typedWords.map(normalizeForComparison);

  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  const result: AlignmentEntry[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "match",
          isError: false,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "substitution",
          isError: true,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j] + 1) {
        result.unshift({
          typed: "",
          original: originalWords[i - 1],
          status: "missing",
          isError: true,
        });
        i--;
      } else {
        result.unshift({
          typed: typedWords[j - 1],
          original: "",
          status: "extra",
          isError: true,
        });
        j--;
      }
    } else if (i > 0) {
      result.unshift({
        typed: "",
        original: originalWords[i - 1],
        status: "missing",
        isError: true,
      });
      i--;
    } else {
      result.unshift({
        typed: typedWords[j - 1],
        original: "",
        status: "extra",
        isError: true,
      });
      j--;
    }
  }

  return result;
}

function alignWords(originalText: string, typedText: string): AlignmentEntry[] {
  const originalWords = (originalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);

  if (originalWords.length === 0 && typedWords.length === 0) return [];
  if (originalWords.length === 0) {
    return typedWords.map((w) => ({
      typed: w, original: "", status: "extra" as AlignmentStatus, isError: true,
    }));
  }
  if (typedWords.length === 0) {
    return originalWords.map((w) => ({
      typed: "", original: w, status: "missing" as AlignmentStatus, isError: true,
    }));
  }

  return alignWordsDP(originalWords, typedWords);
}

function calculateAlignedMistakes(originalText: string, typedText: string) {
  const alignment = alignWords(originalText, typedText);
  
  let lastTypedIndex = -1;
  for (let i = alignment.length - 1; i >= 0; i--) {
    if (alignment[i].typed !== "") {
      lastTypedIndex = i;
      break;
    }
  }
  
  if (lastTypedIndex === -1) {
    return { mistakes: 0, alignment, attemptedAlignment: [] };
  }
  
  let attemptedOriginal = "";
  let attemptedTyped = "";
  
  for (let i = 0; i <= lastTypedIndex; i++) {
    const item = alignment[i];
    attemptedTyped += item.typed;
    attemptedOriginal += item.original;
    if (i < lastTypedIndex) {
      attemptedTyped += " ";
      attemptedOriginal += " ";
    }
  }
  
  const attemptedAlignment = alignWords(attemptedOriginal, attemptedTyped);

  let mistakes = 0;
  
  const commaCount = (word: string) => (word.match(/,/g) || []).length;
  const periodCount = (word: string) => (word.match(/\./g) || []).length;

  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
    } else if (item.status === "extra") {
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
    } else if (item.status === "substitution") {
      const cleanOriginal = item.original.replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = item.typed.replace(/[.,]/g, "").toLowerCase();
      if (cleanOriginal !== cleanTyped) mistakes += 1;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "match") {
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    }
  }

  return { mistakes, alignment, attemptedAlignment };
}

function calculateTypingMetrics(originalText: string, typedText: string, timeInMinutes: number, backspaces: number) {
  const { mistakes, attemptedAlignment } = calculateAlignedMistakes(originalText, typedText);

  const typedWordsInAttempted = attemptedAlignment.filter(
    (a) => a.typed !== "" && a.status !== "missing"
  ).length;

  const wordCount = typedWordsInAttempted;
  const grossSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;

  let netSpeed = 0;
  if (mistakes > timeInMinutes) {
    const penalty = (mistakes - timeInMinutes) * timeInMinutes;
    netSpeed = (wordCount - penalty) / timeInMinutes;
  } else {
    netSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  }
  netSpeed = Math.max(0, netSpeed);

  const missingWords = attemptedAlignment.filter((a) => a.status === "missing").length;

  const formatSpeed = (speed: number) => {
    const rounded = Math.round(speed * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
  };

  let halfMistakes = 0;
  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      halfMistakes += (item.original.match(/,/g) || []).length;
    } else if (item.status === "extra") {
      halfMistakes += (item.typed.match(/,/g) || []).length;
    } else {
      halfMistakes += Math.abs(
        (item.original.match(/,/g) || []).length - (item.typed.match(/,/g) || []).length
      );
    }
  }

  return {
    words: wordCount,
    mistakes,
    halfMistakes,
    grossSpeed: formatSpeed(grossSpeed),
    netSpeed: formatSpeed(netSpeed),
    backspaces,
    missingWords,
  };
}

function calculateShorthandMetrics(originalText: string, typedText: string, timeInMinutes: number) {
  const { mistakes, attemptedAlignment } = calculateAlignedMistakes(originalText, typedText);

  const fullOriginalWords = (originalText || "").trim().split(/\s+/).filter((w) => w).length;

  const mistakePercentage = fullOriginalWords > 0 ? (mistakes / fullOriginalWords) * 100 : 0;
  const isPassed = mistakePercentage <= 5;

  const missingWords = attemptedAlignment.filter((a) => a.status === "missing").length;

  let halfMistakes = 0;
  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      halfMistakes += (item.original.match(/,/g) || []).length;
    } else if (item.status === "extra") {
      halfMistakes += (item.typed.match(/,/g) || []).length;
    } else {
      halfMistakes += Math.abs(
        (item.original.match(/,/g) || []).length - (item.typed.match(/,/g) || []).length
      );
    }
  }

  return {
    words: fullOriginalWords,
    mistakes,
    halfMistakes,
    result: isPassed ? "Pass" : "Fail",
    missingWords,
  };
}

async function regenerateResults() {
  console.log("Fetching latest 50 results...");
  
  const latestResults = await db
    .select()
    .from(results)
    .orderBy(desc(results.id))
    .limit(50);

  console.log(`Found ${latestResults.length} results to process.`);

  let updated = 0;
  let skipped = 0;

  for (const result of latestResults) {
    if (!result.originalText) {
      console.log(`Skipping result ${result.id} - no original text stored`);
      skipped++;
      continue;
    }

    const timeInMinutes = result.time; // time is already stored in minutes
    
    try {
      if (result.contentType === "typing") {
        const metrics = calculateTypingMetrics(
          result.originalText,
          result.typedText,
          timeInMinutes,
          result.backspaces || 0
        );

        await db
          .update(results)
          .set({
            words: metrics.words,
            mistakes: String(metrics.mistakes),
            halfMistakes: String(metrics.halfMistakes),
            grossSpeed: String(metrics.grossSpeed),
            netSpeed: String(metrics.netSpeed),
          })
          .where(eq(results.id, result.id));

        console.log(`Updated typing result ${result.id}: ${metrics.words} words, ${metrics.mistakes} mistakes, ${metrics.netSpeed} WPM`);
        updated++;
      } else if (result.contentType === "shorthand") {
        const metrics = calculateShorthandMetrics(
          result.originalText,
          result.typedText,
          timeInMinutes
        );

        await db
          .update(results)
          .set({
            words: metrics.words,
            mistakes: String(metrics.mistakes),
            halfMistakes: String(metrics.halfMistakes),
            result: metrics.result,
          })
          .where(eq(results.id, result.id));

        console.log(`Updated shorthand result ${result.id}: ${metrics.words} words, ${metrics.mistakes} mistakes, ${metrics.result}`);
        updated++;
      } else {
        console.log(`Skipping result ${result.id} - unknown type: ${result.contentType}`);
        skipped++;
      }
    } catch (error) {
      console.error(`Error processing result ${result.id}:`, error);
      skipped++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
  process.exit(0);
}

regenerateResults().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
