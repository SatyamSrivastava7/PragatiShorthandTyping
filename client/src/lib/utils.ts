import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Result } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Special characters that can split words (user types them as spaces)
const SPLIT_CHAR_PATTERN = /[-–—\/\\:;|+&_~]/;

// Normalize characters for comparison
// Handles:
// - Dashes: − (minus U+2212), – (en dash U+2013), — (em dash U+2014), ‐ (hyphen U+2010), etc.
// - Quotes: " (left double U+201C), " (right double U+201D), ' (left single U+2018), ' (right single U+2019), etc.
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-") // Normalize all dash-like characters to hyphen
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"') // Normalize curved/smart double quotes to straight quote
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'") // Normalize curved/smart single quotes to straight quote
    .toLowerCase();
}

// Alignment entry types: match, substitution, missing (skipped original), extra (typed but not in original), trailing (untyped at end)
export type AlignmentStatus = "match" | "substitution" | "missing" | "extra" | "trailing";

export interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

/**
 * Post-process alignment to fix trailing error pattern
 * 
 * When the DP algorithm can't find a match for a word at the end, it may mark
 * many original words as "missing" while the typed word becomes "extra".
 * This function converts that pattern to:
 * - The typed word becomes a "substitution" for the expected original word at its position
 * - Remaining original words become "trailing" (not counted as errors for typing tests)
 */
function fixTrailingErrorPattern(alignment: AlignmentEntry[], typedWordCount: number): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  
  let result = [...alignment];
  
  // Find the last typed word position
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") {
      lastTypedIdx = i;
      break;
    }
  }
  
  if (lastTypedIdx === -1) return result;
  
  // Mark all words after the last typed word as trailing
  for (let i = lastTypedIdx + 1; i < result.length; i++) {
    if (result[i].status === "missing") {
      result[i] = { ...result[i], status: "trailing", isError: false };
    }
  }
  
  // Now fix the pattern where consecutive missing words appear before a typed word
  // Scan through and fix any occurrence where we have >2 consecutive missing followed by extra/typed
  let i = 0;
  while (i < result.length) {
    // Look for a block of consecutive missing words
    if (result[i].status === "missing") {
      let missingStart = i;
      let missingCount = 0;
      
      while (i < result.length && result[i].status === "missing") {
        missingCount++;
        i++;
      }
      
      // Check if next item is a typed word (extra or doesn't match pattern)
      if (i < result.length && result[i].typed !== "" && result[i].status === "extra" && missingCount > 2) {
        // This is the problematic pattern: many missing followed by an "extra"
        // Convert first missing + extra to substitution
        const typedWord = result[i].typed;
        const originalWord = result[missingStart].original;
        
        result[missingStart] = {
          typed: typedWord,
          original: originalWord,
          status: "substitution",
          isError: true,
        };
        
        // Mark remaining missing words in this block as trailing
        for (let j = missingStart + 1; j < i; j++) {
          if (result[j].status === "missing") {
            result[j] = { ...result[j], status: "trailing", isError: false };
          }
        }
        
        // Remove the extra entry (now merged into substitution)
        result.splice(i, 1);
        // Don't increment i, check same position again
      }
    } else {
      i++;
    }
  }
  
  // Final pass: mark all words after the last actual typed position as trailing
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
  
  return result;
}

/**
 * Optimal word alignment using Dynamic Programming (Wagner-Fischer algorithm)
 * 
 * This algorithm finds the minimum edit distance between original and typed words,
 * producing an optimal alignment that minimizes the total number of operations
 * (insertions, deletions, and substitutions).
 * 
 * Time complexity: O(n*m) where n = original words, m = typed words
 * Space complexity: O(n*m) for the DP table and backtracking
 * 
 * For very long texts (>500 words), falls back to a windowed approach for performance.
 */
export function alignWords(
  originalText: string,
  typedText: string,
): AlignmentEntry[] {
  const originalWords = (originalText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  const typedWords = (typedText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w);

  const n = originalWords.length;
  const m = typedWords.length;

  // Edge cases
  if (n === 0 && m === 0) return [];
  if (n === 0) {
    return typedWords.map((w) => ({
      typed: w,
      original: "",
      status: "extra" as AlignmentStatus,
      isError: true,
    }));
  }
  if (m === 0) {
    return originalWords.map((w) => ({
      typed: "",
      original: w,
      status: "missing" as AlignmentStatus,
      isError: true,
    }));
  }

  // For very long texts, use windowed DP to avoid memory issues
  // This splits the text into chunks and aligns each chunk separately
  const MAX_DP_SIZE = 500;
  if (n > MAX_DP_SIZE || m > MAX_DP_SIZE) {
    return alignWordsWindowed(originalWords, typedWords);
  }

  // Standard DP alignment for normal-sized texts
  return alignWordsDP(originalWords, typedWords);
}

/**
 * Core DP-based alignment algorithm
 * Uses Wagner-Fischer algorithm to find optimal alignment
 */
function alignWordsDP(originalWords: string[], typedWords: string[]): AlignmentEntry[] {
  const n = originalWords.length;
  const m = typedWords.length;

  // Pre-compute normalized words for faster comparison
  const normalizedOriginal = originalWords.map(normalizeForComparison);
  const normalizedTyped = typedWords.map(normalizeForComparison);

  // DP table: dp[i][j] = minimum cost to align original[0..i-1] with typed[0..j-1]
  // Cost scheme: match = 0, substitution = 1, insertion = 1, deletion = 1
  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= n; i++) dp[i][0] = i; // Delete all original words
  for (let j = 0; j <= m; j++) dp[0][j] = j; // Insert all typed words

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch) {
        dp[i][j] = dp[i - 1][j - 1]; // Match - no cost
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // Substitution
          dp[i - 1][j] + 1,     // Deletion (missing word)
          dp[i][j - 1] + 1      // Insertion (extra word)
        );
      }
    }
  }

  // Backtrack to build alignment
  const result: AlignmentEntry[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
        // Match
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "match",
          isError: false,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
        // Substitution
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "substitution",
          isError: true,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j] + 1) {
        // Deletion (missing word)
        result.unshift({
          typed: "",
          original: originalWords[i - 1],
          status: "missing",
          isError: true,
        });
        i--;
      } else {
        // Insertion (extra word)
        result.unshift({
          typed: typedWords[j - 1],
          original: "",
          status: "extra",
          isError: true,
        });
        j--;
      }
    } else if (i > 0) {
      // Remaining original words are missing
      result.unshift({
        typed: "",
        original: originalWords[i - 1],
        status: "missing",
        isError: true,
      });
      i--;
    } else {
      // Remaining typed words are extra
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

/**
 * Windowed alignment for very long texts
 * Splits text into chunks and aligns each chunk separately using anchors
 * This provides near-optimal alignment with O(n) space complexity
 */
function alignWordsWindowed(originalWords: string[], typedWords: string[]): AlignmentEntry[] {
  const WINDOW_SIZE = 200;
  const OVERLAP = 50;
  const result: AlignmentEntry[] = [];
  
  let origIndex = 0;
  let typedIndex = 0;

  while (origIndex < originalWords.length || typedIndex < typedWords.length) {
    // Extract current window
    const origEnd = Math.min(origIndex + WINDOW_SIZE, originalWords.length);
    const typedEnd = Math.min(typedIndex + WINDOW_SIZE, typedWords.length);
    
    const origWindow = originalWords.slice(origIndex, origEnd);
    const typedWindow = typedWords.slice(typedIndex, typedEnd);

    if (origWindow.length === 0 && typedWindow.length === 0) break;

    // Align this window
    const windowAlignment = alignWordsDP(origWindow, typedWindow);
    
    // Find a good anchor point to avoid overlap issues
    // An anchor is a matched word that appears in both texts
    let anchorIdx = windowAlignment.length;
    if (origEnd < originalWords.length || typedEnd < typedWords.length) {
      // Find last matched word within safe range
      for (let i = Math.max(0, windowAlignment.length - OVERLAP); i < windowAlignment.length; i++) {
        if (windowAlignment[i].status === "match") {
          anchorIdx = i + 1;
        }
      }
    }

    // Add alignment entries up to anchor
    for (let i = 0; i < anchorIdx; i++) {
      result.push(windowAlignment[i]);
    }

    // Calculate how many words we consumed
    let origConsumed = 0;
    let typedConsumed = 0;
    for (let i = 0; i < anchorIdx; i++) {
      if (windowAlignment[i].original !== "") origConsumed++;
      if (windowAlignment[i].typed !== "") typedConsumed++;
    }

    origIndex += origConsumed;
    typedIndex += typedConsumed;

    // Prevent infinite loop
    if (origConsumed === 0 && typedConsumed === 0) {
      if (origIndex < originalWords.length) {
        result.push({
          typed: "",
          original: originalWords[origIndex],
          status: "missing",
          isError: true,
        });
        origIndex++;
      } else if (typedIndex < typedWords.length) {
        result.push({
          typed: typedWords[typedIndex],
          original: "",
          status: "extra",
          isError: true,
        });
        typedIndex++;
      }
    }
  }

  return result;
}

// Calculate mistakes using the same alignment as alignWords
// Ensures consistency between displayed alignment and mistake counting
export function calculateAlignedMistakes(
  originalText: string,
  typedText: string,
): { mistakes: number; alignment: AlignmentEntry[]; attemptedAlignment: AlignmentEntry[] } {
  // Use alignWords to get the correct alignment (same as what's displayed)
  const alignment = alignWords(originalText, typedText);
  
  // Find the last typed position in the original text
  // This tells us where the student's attempt ends
  let lastTypedIndex = -1;
  for (let i = alignment.length - 1; i >= 0; i--) {
    if (alignment[i].typed !== "") {
      lastTypedIndex = i;
      break;
    }
  }
  
  // If student didn't type anything, return empty attempted alignment
  if (lastTypedIndex === -1) {
    return { mistakes: 0, alignment, attemptedAlignment: [] };
  }
  
  // Reconstruct the original and typed text up to the last typed position
  // This ensures we use the same alignWords logic on just the attempted portion
  let attemptedOriginal = "";
  let attemptedTyped = "";
  let originalCharIndex = 0;
  
  for (let i = 0; i <= lastTypedIndex; i++) {
    const item = alignment[i];
    attemptedTyped += item.typed;
    attemptedOriginal += item.original;
    
    // Add space between words (except after the last word)
    if (i < lastTypedIndex) {
      attemptedTyped += " ";
      attemptedOriginal += " ";
    }
  }
  
  // Re-run alignWords on just the attempted portions
  // This ensures the same error pairing and representation as the full alignment
  const attemptedAlignment = alignWords(attemptedOriginal, attemptedTyped);

  let mistakes = 0;
  
  function commaCount(word: string) {
    return (word.match(/,/g) || []).length;
  }

  function periodCount(word: string) {
    return (word.match(/\./g) || []).length;
  }

  // Count mistakes based on alignment, following the rules:
  // 1 missing/extra/incorrect word = 1 mistake
  // 1 missing/extra period = 1 mistake
  // 1 missing/extra comma = 0.25 mistake
  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      // Missing word = 1 mistake
      mistakes += 1;
      const origCommas = commaCount(item.original);
      mistakes += origCommas * 0.25; // Each missing comma = 0.25
      const origPeriods = periodCount(item.original);
      mistakes += origPeriods * 1; // Each missing period = 1
    } else if (item.status === "extra") {
      // Extra word = 1 mistake
      mistakes += 1;
      const typedCommas = commaCount(item.typed);
      mistakes += typedCommas * 0.25; // Each extra comma = 0.25
      const typedPeriods = periodCount(item.typed);
      mistakes += typedPeriods * 1; // Each extra period = 1
    } else if (item.status === "substitution") {
      // Wrong word = 1 mistake
      const cleanOriginal = item.original.replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = item.typed.replace(/[.,]/g, "").toLowerCase();
      
      if (cleanOriginal !== cleanTyped) {
        mistakes += 1; // Word content differs
      }
      
      // Count punctuation differences
      const origCommas = commaCount(item.original);
      const typedCommas = commaCount(item.typed);
      const commaDifference = Math.abs(origCommas - typedCommas);
      mistakes += commaDifference * 0.25;
      
      const origPeriods = periodCount(item.original);
      const typedPeriods = periodCount(item.typed);
      const periodDifference = Math.abs(origPeriods - typedPeriods);
      mistakes += periodDifference * 1;
    } else if (item.status === "match") {
      // Matched word but check for punctuation differences
      const origCommas = commaCount(item.original);
      const typedCommas = commaCount(item.typed);
      const commaDifference = Math.abs(origCommas - typedCommas);
      mistakes += commaDifference * 0.25;
      
      const origPeriods = periodCount(item.original);
      const typedPeriods = periodCount(item.typed);
      const periodDifference = Math.abs(origPeriods - typedPeriods);
      mistakes += periodDifference * 1;
    }
  }

  return { mistakes, alignment, attemptedAlignment };
}

/**
 * Get alignment for typing tests with positional greedy approach
 * For typing tests, we assume students type in order, so we use a greedy
 * position-based alignment that looks for matches within a small lookahead window
 */
export function getTypingAlignment(originalText: string, typedText: string): AlignmentEntry[] {
  const originalWords = (originalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);
  
  if (typedWords.length === 0) {
    return originalWords.map(w => ({
      typed: "",
      original: w,
      status: "trailing" as AlignmentStatus,
      isError: false,
    }));
  }
  
  const result: AlignmentEntry[] = [];
  let origIdx = 0;
  const LOOKAHEAD = 5; // Look up to 5 words ahead for a match
  
  // Pre-normalize all words for faster comparison
  const normalizedOriginal = originalWords.map(normalizeForComparison);
  const normalizedTypedWords = typedWords.map(normalizeForComparison);
  
  for (let typedIdx = 0; typedIdx < typedWords.length; typedIdx++) {
    const typedWord = typedWords[typedIdx];
    const normalizedTyped = normalizedTypedWords[typedIdx];
    
    if (origIdx >= originalWords.length) {
      // All original words consumed - remaining typed are extra
      result.push({
        typed: typedWord,
        original: "",
        status: "extra",
        isError: true,
      });
      continue;
    }
    
    // Look for typed word in original (forward lookahead)
    let matchOffset = -1;
    for (let offset = 0; offset <= LOOKAHEAD && origIdx + offset < originalWords.length; offset++) {
      if (normalizedOriginal[origIdx + offset] === normalizedTyped) {
        matchOffset = offset;
        break;
      }
    }
    
    if (matchOffset >= 0) {
      // Found a match - mark any skipped original words as missing
      for (let skip = 0; skip < matchOffset; skip++) {
        result.push({
          typed: "",
          original: originalWords[origIdx],
          status: "missing",
          isError: true,
        });
        origIdx++;
      }
      // Add the match
      result.push({
        typed: typedWord,
        original: originalWords[origIdx],
        status: "match",
        isError: false,
      });
      origIdx++;
    } else {
      // No match for typed word in original lookahead
      // Check if current original word matches a future typed word (typed word is extra)
      const currentOrigNorm = normalizedOriginal[origIdx];
      let isExtra = false;
      
      for (let futureTyped = typedIdx + 1; futureTyped <= typedIdx + LOOKAHEAD && futureTyped < typedWords.length; futureTyped++) {
        if (normalizedTypedWords[futureTyped] === currentOrigNorm) {
          // Current original will match a future typed word, so current typed is EXTRA
          isExtra = true;
          break;
        }
      }
      
      if (isExtra) {
        // Typed word is extra (not in original)
        result.push({
          typed: typedWord,
          original: "",
          status: "extra",
          isError: true,
        });
        // Don't advance origIdx
      } else {
        // Substitution - typed word replaces current original word
        result.push({
          typed: typedWord,
          original: originalWords[origIdx],
          status: "substitution",
          isError: true,
        });
        origIdx++;
      }
    }
  }
  
  // Mark remaining original words as trailing
  for (let i = origIdx; i < originalWords.length; i++) {
    result.push({
      typed: "",
      original: originalWords[i],
      status: "trailing",
      isError: false,
    });
  }
  
  return result;
}

/**
 * Calculate mistakes for typing tests using DP alignment with trailing fix
 * Only counts errors within the attempted portion (not trailing untyped words)
 */
export function calculateTypingMistakes(
  originalText: string,
  typedText: string,
): { mistakes: number; alignment: AlignmentEntry[]; attemptedWords: number; trailingWords: number } {
  const alignment = getTypingAlignment(originalText, typedText);
  
  let mistakes = 0;
  let attemptedWords = 0;
  let trailingWords = 0;
  
  function commaCount(word: string) {
    return (word.match(/,/g) || []).length;
  }

  function periodCount(word: string) {
    return (word.match(/\./g) || []).length;
  }

  for (const item of alignment) {
    if (item.status === "trailing") {
      // Trailing untyped words - not counted as mistakes for typing tests
      trailingWords++;
      continue;
    }
    
    if (item.status === "extra") {
      // Extra word typed = 1 mistake + punctuation
      attemptedWords++;
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
    } else if (item.status === "substitution") {
      // Wrong word = 1 mistake + punctuation differences
      attemptedWords++;
      const cleanOriginal = item.original.replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = item.typed.replace(/[.,]/g, "").toLowerCase();
      
      if (cleanOriginal !== cleanTyped) {
        mistakes += 1;
      }
      
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "match") {
      // Matched word - check for punctuation differences
      attemptedWords++;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    }
  }

  return { mistakes, alignment, attemptedWords, trailingWords };
}

export function calculateTypingMetrics(
  originalText: string,
  typedText: string,
  timeInMinutes: number,
  backspaces: number,
) {
  // Use sequential alignment for typing tests (1-to-1 word matching in order)
  // This ensures a mistyped word doesn't cause cascading "missing" errors
  const { mistakes, alignment, attemptedWords, trailingWords } = calculateTypingMistakes(
    originalText,
    typedText,
  );

  // Word count is the number of words the student actually typed
  const wordCount = alignment.filter(a => a.typed !== "").length;

  const grossSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;

  let netSpeed = 0;

  if (mistakes > timeInMinutes) {
    // Formula: (Total words typed - (no. of Mistakes - Total time)* Total time)/Total time
    const penalty = (mistakes - timeInMinutes) * timeInMinutes;
    netSpeed = (wordCount - penalty) / timeInMinutes;
  } else {
    // If No. of mistakes is less than or equal to Total time => Net Speed = Total words typed / Total time;
    netSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  }

  // Ensure net speed isn't negative
  netSpeed = Math.max(0, netSpeed);

  // With sequential alignment, there are no "missing" words in the attempted portion
  // Missing words only occur from the DP alignment - sequential has "trailing" instead
  const missingWords = 0;

  // Helper to format to 2 decimal places, removing trailing .00
  const formatSpeed = (speed: number) => {
    const rounded = Math.round(speed * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
  };

  // Calculate half mistakes (comma errors)
  let halfMistakes = 0;
  for (const item of alignment) {
    if (item.status === "trailing") continue;
    
    if (item.status === "extra") {
      const typedCommas = (item.typed.match(/,/g) || []).length;
      halfMistakes += typedCommas;
    } else if (item.status === "substitution" || item.status === "match") {
      const origCommas = (item.original.match(/,/g) || []).length;
      const typedCommas = (item.typed.match(/,/g) || []).length;
      halfMistakes += Math.abs(origCommas - typedCommas);
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
    trailingWords,
  };
}

/**
 * Check if the student typed the last 3 words exactly (exact match).
 * Returns true only if all last 3 words have "match" status (no mistakes, missing, or substitutions).
 */
export function isLastSentenceAttempted(
  originalText: string,
  alignment: AlignmentEntry[]
): boolean {
  // Extract the last 3 words from the original text
  const words = originalText
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  
  if (words.length === 0) return false;

  // Get the last 3 words (or fewer if text has less than 3 words)
  const numWordsToCheck = Math.min(3, words.length);
  const lastWordsToMatch = words.slice(-numWordsToCheck).map((w) => normalizeForComparison(w));

  // Track how many of the last N words we've found with exact match
  let matchedCount = 0;
  
  // Scan alignment from the end backwards to find matches for the last 3 words
  for (let i = alignment.length - 1; i >= 0 && matchedCount < numWordsToCheck; i--) {
    const alignmentItem = alignment[i];
    
    // Check if this alignment item's original word is one we're looking for
    // and if it has an exact match status
    if (alignmentItem.status === "match") {
      const originalWord = normalizeForComparison(alignmentItem.original);
      
      // Check if this word matches one of our target words (from the end)
      if (originalWord === lastWordsToMatch[numWordsToCheck - 1 - matchedCount]) {
        matchedCount++;
      }
    }
  }

  // Return true only if all last 3 words are exact matches (no missing, substitution, or extra)
  return matchedCount === numWordsToCheck;
}

export function calculateShorthandMetrics(
  originalText: string,
  typedText: string,
  timeInMinutes: number,
) {
  // Use aligned word comparison to handle word splits/joins
  const { mistakes, attemptedAlignment } = calculateAlignedMistakes(
    originalText,
    typedText,
  );

  // For Shorthand: Calculate metrics based on FULL ORIGINAL TEXT word count
  // This is the total words in the entire passage, not just what was attempted
  const fullOriginalWords = (originalText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w).length;

  // 5% rule: More than 5% mistakes = Fail, 5% or less = Pass
  // Calculate percentage based on FULL ORIGINAL TEXT word count
  const mistakePercentage =
    fullOriginalWords > 0 ? (mistakes / fullOriginalWords) * 100 : 0;
  const isPassed = mistakePercentage <= 5;

  // Count missing words only from attempted portion (not trailing untyped words)
  const missingWords = attemptedAlignment.filter((a) => a.status === "missing").length;

  // Calculate half mistakes (comma errors: missing or extra commas)
  // Count all comma differences from the alignment
  let halfMistakes = 0;

  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      // Missing word - count its commas as missing
      const origCommas = (item.original.match(/,/g) || []).length;
      halfMistakes += origCommas;
    } else if (item.status === "extra") {
      // Extra typed word - count its commas as extra
      const typedCommas = (item.typed.match(/,/g) || []).length;
      halfMistakes += typedCommas;
    } else if (item.status === "substitution") {
      // Substitution - count comma difference
      const origCommas = (item.original.match(/,/g) || []).length;
      const typedCommas = (item.typed.match(/,/g) || []).length;
      halfMistakes += Math.abs(origCommas - typedCommas);
    } else if (item.status === "match") {
      // Match - count comma difference (if any)
      const origCommas = (item.original.match(/,/g) || []).length;
      const typedCommas = (item.typed.match(/,/g) || []).length;
      halfMistakes += Math.abs(origCommas - typedCommas);
    }
  }

  return {
    words: fullOriginalWords,
    mistakes,
    halfMistakes,
    result: isPassed ? "Pass" : ("Fail" as "Pass" | "Fail"),
    missingWords,
  };
}

export const generateResultPDF = async (result: Result) => {
  // Generate filename: StudentName_TypeOfResult_Date
  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, "_");
  const studentName = sanitizeName(result.studentName);
  const resultType =
    result.contentType.charAt(0).toUpperCase() + result.contentType.slice(1);
  const dateStr = format(new Date(result.submittedAt), "yyyy-MM-dd");
  const fileName = `${studentName}_${resultType}_${dateStr}`;

  // Use a completely different approach: browser native print
  // Create a hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  // Font selection based on language
  const contentFont =
    result.language === "hindi"
      ? "font-family: 'Mangal', 'Tiro Devanagari Hindi', 'Mukta', sans-serif;"
      : "font-family: 'Times New Roman', Times, serif;";

  // For typing tests, use sequential alignment (1-to-1 word matching)
  // For shorthand tests, use DP alignment (global optimization)
  let displayAlignment: AlignmentEntry[];
  let trailingWords: string[] = [];

  if (result.contentType === "typing") {
    // Use typing alignment with trailing fix (same as result analysis)
    displayAlignment = getTypingAlignment(result.originalText || "", result.typedText);
    trailingWords = displayAlignment
      .filter(item => item.status === "trailing")
      .map(item => item.original);
  } else {
    // DP alignment for shorthand
    const { attemptedAlignment, alignment } = calculateAlignedMistakes(result.originalText || "", result.typedText);
    displayAlignment = attemptedAlignment;
    
    // Calculate trailing words for shorthand
    const trailingItems = alignment.filter((item) => {
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });
    trailingWords = trailingItems.map((item) => item.original).filter((w) => w);
  }

  // Count actual missing words (not trailing)
  const missingWordsCount = displayAlignment.filter(item => item.status === "missing").length;

  let typedHtml = "";

  // Generate HTML for typed content with error highlighting
  for (let i = 0; i < displayAlignment.length; i++) {
    const item = displayAlignment[i];
    
    if (item.status === "trailing") {
      // Trailing untyped words - skip in PDF for typing tests (not counted as errors)
      continue;
    } else if (item.status === "missing") {
      // Missing word - show in green brackets
      typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${item.original}]</span> `;
    } else if (item.status === "substitution") {
      // Substitution - show correct word in green brackets FIRST, then typed word underlined in red
      typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${item.original}]</span><span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${item.typed}</span> `;
    } else if (item.status === "extra") {
      // Extra word - show underlined in red
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${item.typed}</span> `;
    } else {
      // Match - show normally
      typedHtml += `<span>${item.typed}</span> `;
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${fileName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 6px; color: #000; background: #fff; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 8mm; }
        }
        h1 { color: #1e3a8a; font-size: 20px; margin: 0 0 2px 0; text-align: center; }
        p.subtitle { text-align: center; color: #555; margin: 0 0 8px 0; font-size: 12px; }
        h2 { font-size: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 8px; margin-bottom: 8px; text-align: center; }
        h3 { font-size: 16px; margin: 16px 0 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 14px; }
        td { padding: 4px 6px; vertical-align: top; }
        .label { font-weight: bold; width: 100px; }
        .metrics-table th, .metrics-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .metrics-table th { background-color: #f8fafc; }
        .content-box { padding: 4px; background-color: #ffff; border-radius: 4px; line-height: 1.4; margin-bottom: 6px; font-size: 12px; white-space: pre-wrap; }
        .error { color: #dc2626; font-weight: bold; }
        .success { color: #15803d; font-weight: bold; }
        .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Pragati Institute of Professional Studies</h1>
      <p class="subtitle">Kalindipuram, Prayagraj, 211011</p>
      <p class="subtitle">Contact No: 9026212705</p>
      <h2>Test Result Report</h2>

      <table>
        <tr>
          <td class="label">Student Name:</td><td>${result.studentName}</td>
          <td class="label">Student ID:</td><td>${result.studentDisplayId || result.studentId}</td>
        </tr>
        <tr>
          <td class="label">Test Title:</td><td>${result.contentTitle}</td>
          <td class="label">Date:</td><td>${format(new Date(result.submittedAt), "PPP p")}</td>
        </tr>
        <tr>
          <td class="label">Type:</td><td style="text-transform: capitalize;">${result.contentType}</td>
          <td class="label">Test Duration:</td><td>${result.time} minutes</td>
        </tr>
        <tr>
          <td class="label">Language:</td><td style="text-transform: capitalize;">${result.language}</td>
          <td></td><td></td>
        </tr>
      </table>

      <h3>Performance Metrics</h3>
      <table class="metrics-table">
        <tr>
          <th>Metric</th><th>Value</th><th>Metric</th><th>Value</th>
        </tr>
        <tr>
          <td>Total Original Words</td><td>${(result.originalText || "").trim().split(/\s+/).filter((w: string) => w).length}</td>
          <td>${result.contentType === "typing" ? "Total Words Typed" : "Total Words Attempted"}</td><td>${result.words}</td>
        </tr>
        <tr>
          <td>Total Mistakes</td><td class="error">${result.mistakes}</td>
          <td>Missing Words</td><td class="error">${missingWordsCount}</td>
        </tr>
        ${
          result.contentType === "typing"
            ? `
        <tr>
          <td>No. of Punctuation Mistakes</td><td class="error">${result.halfMistakes !== null && result.halfMistakes !== undefined ? result.halfMistakes : "Not Available"}</td>
          <td>Backspaces</td><td>${result.backspaces}</td>
        </tr>
        <tr>
          <td>Accuracy</td><td class="success">${result.words > 0 && parseFloat(String(result.mistakes)) < result.words ? ((parseFloat(String(result.mistakes)) * 100) / result.words).toFixed(2) : "0.00"}%</td>
          <td>Gross Speed</td><td>${result.grossSpeed} WPM</td>
        </tr>
        <tr>
          <td>Net Speed</td><td class="success">${result.netSpeed} WPM</td>
          <td></td><td></td>
        </tr>
        `
            : `
        <tr>
          <td>Punctuation Mistake</td><td class="error">${result.halfMistakes !== null && result.halfMistakes !== undefined ? result.halfMistakes : "Not Available"}</td>
          <td>Mistake%</td><td class="${result.result === "Pass" ? "success" : "error"}">${result.words > 0 ? ((parseInt(result.mistakes)*100)/result.words).toFixed(2) : "0.00"}%</td>
        </tr>
        <tr>
          <td>Left Words</td><td>${trailingWords.length}</td>
          <td>Result</td><td class="${result.result === "Pass" ? "success" : "error"}">${result.result}</td>
        </tr>
        `
        }
      </table>

      <h3>Typed Content (Errors Underlined)</h3>
      <div class="content-box" style="${contentFont}">
        ${typedHtml}
      </div>

      <div class="footer">
        Generated by Pragati Institute Portal • ${format(new Date(), "PPP")}
      </div>
    </body>
    </html>
  `;

  // Write content to iframe
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Wait for images/fonts to load then print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Cleanup after print dialog closes (approximate)
      // Note: We can't detect exactly when print cancels, so we just leave it or remove after long delay.
      // Better to remove immediately? No, some browsers need it there.
      // Let's remove after 1 minute or on next call.
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);
    }, 500);
  }
};
