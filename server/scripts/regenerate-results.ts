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
    .replace(/[.,!?;:]+$/g, "") // Strip trailing punctuation for word matching
    .toLowerCase();
}

type AlignmentStatus = "match" | "substitution" | "missing" | "extra" | "trailing";

interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

function fixTrailingErrorPattern(alignment: AlignmentEntry[], typedWordCount: number): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  
  let result = [...alignment];
  
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") {
      lastTypedIdx = i;
      break;
    }
  }
  
  if (lastTypedIdx === -1) return result;
  
  for (let i = lastTypedIdx + 1; i < result.length; i++) {
    if (result[i].status === "missing") {
      result[i] = { ...result[i], status: "trailing", isError: false };
    }
  }
  
  let i = 0;
  while (i < result.length) {
    if (result[i].status === "missing") {
      let missingStart = i;
      let missingCount = 0;
      
      while (i < result.length && result[i].status === "missing") {
        missingCount++;
        i++;
      }
      
      // Check if next item is a typed word (extra or substitution) and there are many missing before
      if (i < result.length && result[i].typed !== "" && 
          (result[i].status === "extra" || result[i].status === "substitution") && missingCount > 2) {
        const typedWord = result[i].typed;
        const originalWord = result[missingStart].original;
        
        result[missingStart] = {
          typed: typedWord,
          original: originalWord,
          status: "substitution",
          isError: true,
        };
        
        // Keep remaining missing words as "missing" (green) - they are skipped, not trailing
        // Only words AFTER the last typed position should be trailing
        
        result.splice(i, 1);
      }
    } else {
      i++;
    }
  }
  
  // Additional fix: Handle pattern where a wrong word at the end causes many missing before it
  let lastTyped = -1;
  for (let j = result.length - 1; j >= 0; j--) {
    if (result[j].typed !== "") {
      lastTyped = j;
      break;
    }
  }
  
  if (lastTyped >= 0) {
    let missingBeforeLast = 0;
    let firstMissingIdx = lastTyped;
    for (let j = lastTyped - 1; j >= 0; j--) {
      if (result[j].status === "missing") {
        missingBeforeLast++;
        firstMissingIdx = j;
      } else {
        break;
      }
    }
    
    if (missingBeforeLast > 5) {
      const typedWord = result[lastTyped].typed;
      const originalWord = result[firstMissingIdx].original;
      
      result[firstMissingIdx] = {
        typed: typedWord,
        original: originalWord,
        status: "substitution",
        isError: true,
      };
      
      for (let j = firstMissingIdx + 1; j < lastTyped; j++) {
        if (result[j].status === "missing") {
          result[j] = { ...result[j], status: "trailing", isError: false };
        }
      }
      
      result.splice(lastTyped, 1);
    }
  }
  
  lastTypedIdx = -1;
  for (let j = result.length - 1; j >= 0; j--) {
    if (result[j].typed !== "") {
      lastTypedIdx = j;
      break;
    }
  }
  
  if (lastTypedIdx !== -1) {
    for (let j = lastTypedIdx + 1; j < result.length; j++) {
      if (result[j].status === "missing") {
        result[j] = { ...result[j], status: "trailing", isError: false };
      }
    }
  }
  
  // Check if typed words marked as errors exist in trailing section
  // If a typed word matches a trailing word, it might be correct
  const trailingWords = result
    .filter(item => item.status === "trailing")
    .map(item => item.original.toLowerCase().replace(/[.,!?;:]/g, ""));
  
  for (let j = 0; j < result.length; j++) {
    const item = result[j];
    // If word is marked as extra or substitution but matches a trailing word
    if ((item.status === "extra" || item.status === "substitution") && item.typed) {
      const cleanTyped = item.typed.toLowerCase().replace(/[.,!?;:]/g, "");
      const trailingIdx = trailingWords.indexOf(cleanTyped);
      
      if (trailingIdx !== -1) {
        // This word exists in trailing - convert to a match with trailing word
        if (item.status === "extra") {
          // Extra word that matches trailing - convert to match
          result[j] = {
            typed: item.typed,
            original: item.typed,
            status: "match",
            isError: false,
          };
        } else if (item.status === "substitution") {
          // Check if typed actually matches original (just punctuation diff)
          const cleanOriginal = item.original.toLowerCase().replace(/[.,!?;:]/g, "");
          if (cleanTyped === cleanOriginal) {
            result[j] = { ...item, status: "match", isError: false };
          }
        }
        
        // Remove this word from trailing to avoid duplicate counting
        trailingWords.splice(trailingIdx, 1);
      }
    }
  }
  
  return result;
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
  const originalWords = (originalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);
  
  // Limit search window to prefer earlier occurrences while allowing for skips
  // Use typed word count * 1.5 + buffer to handle skips
  const LOOKAHEAD_BUFFER = 20;
  const alignmentWindow = Math.min(originalWords.length, Math.floor(typedWords.length * 1.5) + LOOKAHEAD_BUFFER);
  const windowedOriginal = originalWords.slice(0, alignmentWindow).join(" ");
  
  const rawAlignment = alignWords(windowedOriginal, typedText);
  const alignment = fixTrailingErrorPattern(rawAlignment, typedWords.length);

  const commaCount = (word: string) => (word.match(/,/g) || []).length;
  const periodCount = (word: string) => (word.match(/\./g) || []).length;

  let mistakes = 0;
  let halfMistakes = 0;
  
  for (const item of alignment) {
    if (item.status === "trailing") continue;
    
    if (item.status === "extra") {
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
      halfMistakes += commaCount(item.typed);
    } else if (item.status === "substitution") {
      const cleanOriginal = item.original.replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = item.typed.replace(/[.,]/g, "").toLowerCase();
      if (cleanOriginal !== cleanTyped) mistakes += 1;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
      halfMistakes += Math.abs(commaCount(item.original) - commaCount(item.typed));
    } else if (item.status === "match") {
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
      halfMistakes += Math.abs(commaCount(item.original) - commaCount(item.typed));
    } else if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
      halfMistakes += commaCount(item.original);
    }
  }

  const wordCount = alignment.filter(a => a.typed !== "").length;
  const grossSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;

  let netSpeed = 0;
  if (mistakes > timeInMinutes) {
    const penalty = (mistakes - timeInMinutes) * timeInMinutes;
    netSpeed = (wordCount - penalty) / timeInMinutes;
  } else {
    netSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  }
  netSpeed = Math.max(0, netSpeed);

  const formatSpeed = (speed: number) => {
    const rounded = Math.round(speed * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
  };

  return {
    words: wordCount,
    mistakes,
    halfMistakes,
    grossSpeed: formatSpeed(grossSpeed),
    netSpeed: formatSpeed(netSpeed),
    backspaces,
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
