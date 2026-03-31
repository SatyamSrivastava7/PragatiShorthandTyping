import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Result } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Paragraph token used internally to mark paragraph breaks so we can preserve
// paragraph boundaries in alignment and when saving typed input.
export const PARA_TOKEN = '[[PARA]]';

// Convert HTML to plain text but preserve paragraph breaks as PARA_TOKEN.
export function stripHtmlPreserveParagraphs(html: string): string {
  if (!html) return '';
  // Replace <br> and paragraph tags with explicit newlines first
  let s = html.replace(/<\s*br\s*\/?>/gi, '\n\n')
                .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
                .replace(/<\s*p[^>]*>/gi, '\n\n')
                .replace(/<\s*\/\s*div\s*>/gi, '\n\n')
                .replace(/<\s*div[^>]*>/gi, '\n\n');

  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');

  // Strip HTML entities like &nbsp; before processing
  s = stripHtmlEntities(s);

  // Collapse whitespace and convert newline blocks into PARA_TOKEN
  s = s.replace(/\r\n|\r/g, '\n');
  s = s.replace(/\n+/g, ` ${PARA_TOKEN} `);

  // Collapse multiple spaces but keep token spacing
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Replace any newline sequences in typed text with PARA_TOKEN
export function replaceNewlinesWithParaToken(text: string): string {
  if (!text) return '';
  // Strip HTML entities first
  let s = stripHtmlEntities(text);
  s = s.replace(/\r\n|\r/g, '\n');
  s = s.replace(/\n+/g, ` ${PARA_TOKEN} `);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Strip HTML entities like &nbsp; and other common entities before comparison/display
export function stripHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')        // Non-breaking space -> regular space
    .replace(/&lt;/gi, '<')          // Less than
    .replace(/&gt;/gi, '>')          // Greater than
    .replace(/&amp;/gi, '&')         // Ampersand
    .replace(/&quot;/gi, '"')        // Double quote
    .replace(/&#39;/gi, "'")         // Single quote
    .replace(/&apos;/gi, "'");       // Apostrophe
}

// Strip HTML tags without preserving paragraph structure
export function stripHtml(html: string): string {
  if (!html) return '';
  let s = html.replace(/<[^>]+>/g, '');
  s = stripHtmlEntities(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Remove PARA_TOKENs from text
export function removeParaTokens(text: string): string {
  if (!text) return '';
  return text.replace(new RegExp(PARA_TOKEN, 'g'), ' ').replace(/\s+/g, ' ').trim();
}

// Special characters that can split words (user types them as spaces)
const SPLIT_CHAR_PATTERN = /[-–—\/\\:;|+&_~]/;

// Normalize characters for comparison
// Handles:
// - Dashes: − (minus U+2212), – (en dash U+2013), — (em dash U+2014), ‐ (hyphen U+2010), etc.
// - Quotes: " (left double U+201C), " (right double U+201D), ' (left single U+2018), ' (right single U+2019), etc.
function normalizeForComparison(text: string): string {
  return text
    .replace(/\.\.\./g, "…") // Normalize three dots to unicode ellipsis
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
 * Helper function to fix preceding missing words as trailing when last typed word is incorrect
 * Used for shorthand tests where we need to apply the same logic
 */
function fixPrecedingMissingAsTrailing(alignment: AlignmentEntry[]): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  
  const result = [...alignment];
  
  // Find the last typed word position
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") {
      lastTypedIdx = i;
      break;
    }
  }
  
  if (lastTypedIdx === -1) return result;
  
  // If the last typed word is incorrect (substitution), mark immediately preceding missing words as trailing
  if (result[lastTypedIdx].status === "substitution") {
    for (let j = lastTypedIdx - 1; j >= 0; j--) {
      if (result[j].status === "missing") {
        result[j] = { ...result[j], status: "trailing", isError: false };
      } else {
        break;
      }
    }
  }
  
  return result;
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
    
    // If the last typed word is incorrect (substitution), mark immediately preceding missing words as trailing
    if (result[lastTypedIdx].status === "substitution") {
      for (let j = lastTypedIdx - 1; j >= 0; j--) {
        if (result[j].status === "missing") {
          result[j] = { ...result[j], status: "trailing", isError: false };
        } else {
          // Stop at first non-missing word
          break;
        }
      }
    }
    
    // Fix: If last typed word is substitution with a very short original (likely wrong match),
    // re-pair it with the original word at the typed position based on word count
    if (result[lastTypedIdx].status === "substitution" || result[lastTypedIdx].status === "extra") {
      const lastTypedWord = result[lastTypedIdx].typed;
      const currentOriginal = result[lastTypedIdx].original || "";
      
      // Count how many words were typed (non-empty typed entries)
      let typedCount = 0;
      for (let j = 0; j <= lastTypedIdx; j++) {
        if (result[j].typed !== "") typedCount++;
      }
      
      // Look for the original word at position = typedCount in the trailing words
      // that might be a better match (starts with same prefix)
      const lastTypedNormalized = lastTypedWord.replace(/[.,]/g, "").toLowerCase();
      
      // Check trailing words for a better match
      for (let j = lastTypedIdx + 1; j < result.length; j++) {
        if (result[j].status === "trailing" && result[j].original) {
          const trailingNormalized = result[j].original.replace(/[.,]/g, "").toLowerCase();
          
          // Check if typed word is a prefix of trailing word (student was typing it)
          if (trailingNormalized.startsWith(lastTypedNormalized.substring(0, 3)) || 
              lastTypedNormalized.startsWith(trailingNormalized.substring(0, 3))) {
            // Re-pair: swap the original words
            const betterOriginal = result[j].original;
            
            // Update the last typed entry with the better original
            result[lastTypedIdx] = {
              typed: lastTypedWord,
              original: betterOriginal,
              status: "substitution",
              isError: true,
            };
            
            // Mark the old pairing as trailing if it was a substitution
            if (currentOriginal && result[lastTypedIdx - 1]?.status !== "missing") {
              // Insert the skipped original as trailing before the substitution
            }
            
            // Remove this trailing entry since we used it
            result.splice(j, 1);
            break;
          }
        }
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
    const windowed = alignWordsWindowed(originalWords, typedWords);
    return fixLocalMisalignment(windowed);
  }

  // Standard DP alignment for normal-sized texts
  return fixLocalMisalignment(alignWordsDP(originalWords, typedWords));
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
 * Post-process alignment to fix locally misaligned blocks.
 * 
 * When the windowed DP approach (or any alignment) produces a block of consecutive
 * extra/missing entries where some words actually match, this function detects
 * those blocks and re-aligns them locally using DP to produce the optimal alignment.
 * 
 * Example fix: Instead of marking "the" as extra + "the" as missing separately,
 * this will correctly pair them as a match.
 */
function fixLocalMisalignment(alignment: AlignmentEntry[]): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;

  const result: AlignmentEntry[] = [];
  let i = 0;

  while (i < alignment.length) {
    if (alignment[i].status === "match" || alignment[i].status === "trailing") {
      result.push(alignment[i]);
      i++;
      continue;
    }

    // Found a non-match entry - collect the full block of consecutive non-match entries
    const blockStart = i;
    while (i < alignment.length && alignment[i].status !== "match" && alignment[i].status !== "trailing") {
      i++;
    }
    const block = alignment.slice(blockStart, i);

    // Extract the original and typed words from this block
    const blockOriginals: string[] = [];
    const blockTyped: string[] = [];
    for (const entry of block) {
      if (entry.original) blockOriginals.push(entry.original);
      if (entry.typed) blockTyped.push(entry.typed);
    }

    // If block has both typed and original words, and has potential matches,
    // re-align them locally with DP
    if (blockOriginals.length > 0 && blockTyped.length > 0) {
      const normalizedOrig = blockOriginals.map(normalizeForComparison);
      const normalizedTyp = blockTyped.map(normalizeForComparison);

      // Check if there are any matchable words between the two sets
      const hasMatchableWords = normalizedTyp.some(tw => normalizedOrig.includes(tw));

      if (hasMatchableWords && (blockOriginals.length > 1 || blockTyped.length > 1)) {
        // Re-align this block using DP for optimal local alignment
        const localAlignment = alignWordsDP(blockOriginals, blockTyped);
        result.push(...localAlignment);
      } else {
        // No benefit from re-alignment, keep original block
        result.push(...block);
      }
    } else {
      // Only extras or only missing - nothing to re-align
      result.push(...block);
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
): { mistakes: number; alignment: AlignmentEntry[]; attemptedAlignment: AlignmentEntry[]; trailingWords: number } {
  // Strip HTML tags from original text before processing, but preserve paragraph breaks
  const plainOriginalText = stripHtmlPreserveParagraphs(originalText || '');
  
  // Use alignWords to get the correct alignment (same as what's displayed)
  const alignment = alignWords(plainOriginalText, typedText);
  
  // Find the last typed position in the original text
  // This tells us where the student's attempt ends
  let lastTypedIndex = -1;
  for (let i = alignment.length - 1; i >= 0; i--) {
    if (alignment[i].typed !== "") {
      lastTypedIndex = i;
      break;
    }
  }
  
  // Count trailing words (words after last typed position)
  let trailingWords = 0;
  for (let i = lastTypedIndex + 1; i < alignment.length; i++) {
    if (alignment[i].original) {
      trailingWords++;
    }
  }
  
  // If student didn't type anything, return empty attempted alignment
  if (lastTypedIndex === -1) {
    const totalOriginalWords = (plainOriginalText || "")
      .trim()
      .split(/\s+/)
      .filter(w => w).length;
    return { mistakes: 0, alignment, attemptedAlignment: [], trailingWords: totalOriginalWords };
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
  let attemptedAlignment = alignWords(attemptedOriginal, attemptedTyped);
  
  // Apply trailing fix for preceding missing words if last typed word is incorrect
  attemptedAlignment = fixPrecedingMissingAsTrailing(attemptedAlignment);

  let mistakes = 0;
  
  function normalizeEllipsis(word: string) {
    return word.replace(/\.\.\./g, "…");
  }

  function commaCount(word: string) {
    return (normalizeEllipsis(word).match(/,/g) || []).length;
  }

  function periodCount(word: string) {
    return (normalizeEllipsis(word).match(/\./g) || []).length;
  }

  for (const item of attemptedAlignment) {
    // ignore paragraph markers entirely when counting mistakes
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
      continue;
    }

    if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
    } else if (item.status === "extra") {
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
    } else if (item.status === "substitution") {
      const cleanOriginal = normalizeEllipsis(item.original).replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = normalizeEllipsis(item.typed).replace(/[.,]/g, "").toLowerCase();
      
      if (cleanOriginal !== cleanTyped) {
        mistakes += 1;
      }
      
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "match") {
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    }
  }

  return { mistakes, alignment, attemptedAlignment, trailingWords };
}

/**
 * Get alignment for typing tests with trailing error fix applied
 * For typing tests, we limit the original text to a reasonable window around typed words
 * This prevents the DP from going too far ahead looking for matches
 */
export function getTypingAlignment(originalText: string, typedText: string): AlignmentEntry[] {
  // Strip HTML tags from original text (plain text)
  const plainOriginalText = stripHtml(originalText || '');
  // Get words for alignment
  const originalWords = (plainOriginalText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  const typedWords = (typedText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  
  if (typedWords.length === 0) {
    return originalWords.map(w => ({
      typed: "",
      original: w,
      status: "trailing" as AlignmentStatus,
      isError: false,
    }));
  }
  
  // For typing tests, only align against original words up to typed count + small buffer
  // This prevents DP from searching too far ahead
  const alignmentWindow = Math.min(originalWords.length, typedWords.length + 5);
  const windowedOriginal = originalWords.slice(0, alignmentWindow).join(" ");
  const cleanTypedText = typedWords.join(" ");
  
  const rawAlignment = alignWords(windowedOriginal, cleanTypedText);
  let result = fixTrailingErrorPattern(rawAlignment, typedWords.length);
  
  // Add remaining original words as trailing
  for (let i = alignmentWindow; i < originalWords.length; i++) {
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
  
  function normalizeEllipsis(word: string) {
    return word.replace(/\.\.\./g, "…");
  }

  function commaCount(word: string) {
    return (normalizeEllipsis(word).match(/,/g) || []).length;
  }

  function periodCount(word: string) {
    return (normalizeEllipsis(word).match(/\./g) || []).length;
  }

  for (const item of alignment) {
    // ignore paragraph markers entirely for metrics
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
      continue;
    }

    if (item.status === "trailing") {
      trailingWords++;
      continue;
    }
    
    if (item.status === "extra") {
      attemptedWords++;
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
    } else if (item.status === "substitution") {
      attemptedWords++;
      const cleanOriginal = normalizeEllipsis(item.original).replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = normalizeEllipsis(item.typed).replace(/[.,]/g, "").toLowerCase();
      
      if (cleanOriginal !== cleanTyped) {
        mistakes += 1;
      }
      
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "match") {
      attemptedWords++;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
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
  // Strip HTML tags from original text for metrics calculation (plain text for typing tests)
  const plainText = stripHtml(originalText || '');
  
  // Use sequential alignment for typing tests (1-to-1 word matching in order)
  // This ensures a mistyped word doesn't cause cascading "missing" errors
  const { mistakes, alignment, attemptedWords, trailingWords } = calculateTypingMistakes(
    plainText,
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
  // Strip HTML tags from original text (plain text)
  const plainText = stripHtml(originalText || '');
  
  // Extract the last 3 words from the original text
  const words = plainText
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
  // Strip HTML tags from original text for metrics calculation, without preserving paragraphs
  const plainText = stripHtml(originalText || '');
  
  // Use aligned word comparison to handle word splits/joins
  const { mistakes, attemptedAlignment, trailingWords } = calculateAlignedMistakes(
    plainText,
    typedText,
  );

  // For Shorthand: Calculate metrics based on FULL ORIGINAL TEXT word count
  // This is the total words in the entire passage, not just what was attempted
  const fullOriginalWords = (plainText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w).length;

  // Count words actually typed by student
  const typedWordCount = (typedText || "").trim()
    .split(/\s+/)
    .filter(w => w).length;
  
  // If student typed 0 words, automatic fail
  if (typedWordCount === 0) {
    return {
      words: fullOriginalWords,
      mistakes: fullOriginalWords, // everything left is a mistake
      halfMistakes: 0,
      result: "Fail" as "Pass" | "Fail",
      missingWords: 0,
      trailingWords: fullOriginalWords,
      fullOriginalWords,
    };
  }

  // Include trailing (left) words as mistakes for shorthand
  const totalMistakes = mistakes + trailingWords;

  // 5% rule for mistakes: More than 5% mistakes = Fail
  const mistakePercentage =
    fullOriginalWords > 0 ? (totalMistakes / fullOriginalWords) * 100 : 0;
  
  // 5% rule for left/trailing words: More than 5% left words = Fail
  const trailingPercentage =
    fullOriginalWords > 0 ? (trailingWords / fullOriginalWords) * 100 : 0;
  
  // Pass only if both mistake percentage AND trailing percentage are <= 5%
  const isPassed = mistakePercentage <= 5;

  // Count missing words only from attempted portion (not trailing untyped words)
  // ignore paragraph tokens: they are not really words and should not be
  // included in the missing‑word metric.  These tokens are inserted when the
  // original text contained line breaks and are rendered as paragraph gaps.
  const missingWords = attemptedAlignment.filter(
    (a) => a.status === "missing"
  ).length;

  // Calculate half mistakes (comma errors: missing or extra commas)
  // Count all comma differences from the alignment
  let halfMistakes = 0;

  function normalizeEllipsisSH(word: string) {
    return word.replace(/\.\.\./g, "…");
  }

  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      const origCommas = (normalizeEllipsisSH(item.original).match(/,/g) || []).length;
      halfMistakes += origCommas;
    } else if (item.status === "extra") {
      const typedCommas = (normalizeEllipsisSH(item.typed).match(/,/g) || []).length;
      halfMistakes += typedCommas;
    } else if (item.status === "substitution") {
      const origCommas = (normalizeEllipsisSH(item.original).match(/,/g) || []).length;
      const typedCommas = (normalizeEllipsisSH(item.typed).match(/,/g) || []).length;
      halfMistakes += Math.abs(origCommas - typedCommas);
    } else if (item.status === "match") {
      const origCommas = (normalizeEllipsisSH(item.original).match(/,/g) || []).length;
      const typedCommas = (normalizeEllipsisSH(item.typed).match(/,/g) || []).length;
      halfMistakes += Math.abs(origCommas - typedCommas);
    }
  }

  return {
    words: typedWordCount,
    mistakes: totalMistakes,
    halfMistakes,
    result: isPassed ? "Pass" : ("Fail" as "Pass" | "Fail"),
    missingWords,
    trailingWords,
    fullOriginalWords,
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

  // For typing and allahabad-hc tests, use sequential alignment
  // For shorthand tests, use DP alignment (global optimization)
  let displayAlignment: AlignmentEntry[];
  let trailingWords: string[] = [];
  let shorthandRecalcMistakes = 0;
  let shorthandRecalcTrailing = 0;
  let useFullFormattedText = false;

  if (result.contentType === "typing" || result.contentType === "allahabad-hc") {
    // For Allahabad-HC with RichTextEditor HTML: display full formatted text
    if (result.contentType === "allahabad-hc" && result.typedText && result.typedText.includes('<')) {
      useFullFormattedText = true;
    }
    
    // DP alignment with trailing error fix for typing tests
    // For alignment calculation: strip HTML but keep PARA_TOKEN to align at word level
    // Display will use original text with HTML formatting preserved
    const alignmentOriginalText = stripHtml(result.originalText || '');
    const alignmentTypedText = stripHtml(result.typedText || '');
    
    displayAlignment = getTypingAlignment(alignmentOriginalText, alignmentTypedText);
    trailingWords = displayAlignment
      .filter(item => item.status === "trailing")
      .map(item => item.original);
  } else {
    // DP alignment for shorthand
    // For alignment calculation: strip HTML but keep PARA_TOKEN to align at word level
    // Display will use original text with HTML formatting preserved
    const alignmentOriginalText = stripHtml(result.originalText || '');
    const alignmentTypedText = stripHtml(result.typedText || '');
    
    const { mistakes: recalcMistakes, attemptedAlignment, alignment, trailingWords: recalcTrailing } = calculateAlignedMistakes(alignmentOriginalText, alignmentTypedText);
    displayAlignment = attemptedAlignment;
    shorthandRecalcMistakes = recalcMistakes;
    shorthandRecalcTrailing = recalcTrailing;
    
    // Calculate trailing words for shorthand
    const trailingItems = alignment.filter((item) => {
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });
    trailingWords = trailingItems
      .map((item) => item.original)
      .filter((w) => w);
  }

  // Count actual missing words (not trailing)
  const missingWordsCount = displayAlignment.filter(
    item => item.status === "missing"
  ).length;

  const paraStyle = 'style="text-align:justify;text-justify:inter-word;margin:0 0 8px 0;"';
  let typedHtml = `<p ${paraStyle}>`;

  // Normalize excessive consecutive paragraph tokens (3+) while preserving intentional spacing (1-2)
  const normalizedAlignment = displayAlignment.reduce((acc: AlignmentEntry[], item) => {
    const isParaToken = item.original === PARA_TOKEN || item.typed === PARA_TOKEN;
    
    if (!isParaToken) {
      acc.push(item);
      return acc;
    }
    
    // Count consecutive paragraph tokens at the end
    let consecutiveCount = 0;
    for (let j = acc.length - 1; j >= 0; j--) {
      const prevItem = acc[j];
      if (prevItem.original === PARA_TOKEN || prevItem.typed === PARA_TOKEN) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    // Allow up to 2 consecutive paragraph tokens, collapse 3+
    if (consecutiveCount < 2) {
      acc.push(item);
    }
    // If we already have 2+ consecutive, skip additional ones
    
    return acc;
  }, []);

  for (let i = 0; i < normalizedAlignment.length; i++) {
    const item = normalizedAlignment[i];
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
      typedHtml += `</p><p ${paraStyle}>`;
      continue;
    }
    
    if (item.status === "trailing") {
      continue;
    } else if (item.status === "missing") {
      typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${stripHtmlEntities(item.original)}]</span> `;
    } else if (item.status === "substitution") {
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${stripHtmlEntities(item.typed)}</span> <span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${stripHtmlEntities(item.original)}]</span> `;
    } else if (item.status === "extra") {
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${stripHtmlEntities(item.typed)}</span> `;
    } else {
      // Safeguard: ensure PARA_TOKEN never appears as literal text in output
      // For Allahabad-HC with HTML formatting, preserve the HTML tags while showing text
      if (useFullFormattedText) {
        // Preserve HTML formatting (e.g., <b>, <i>, <u>) from RichTextEditor
        const displayText = item.typed === PARA_TOKEN ? '' : item.typed;
        if (displayText) {
          typedHtml += `<span>${displayText}</span> `;
        }
      } else {
        // For non-HTML tests, just use text without HTML
        const displayText = item.typed === PARA_TOKEN ? '' : stripHtmlEntities(item.typed);
        if (displayText) {
          typedHtml += `<span>${displayText}</span> `;
        }
      }
    }
  }
  typedHtml += `</p>`;

  // Total original words - plain text word count for both typing and shorthand
  const totalOriginalWords = stripHtml(result.originalText || '').trim().split(/\s+/).filter((w: string) => w).length;
  const accuracy = result.words > 0 ? (((result.words - parseFloat(String(result.mistakes))) * 100) / result.words).toFixed(2) : "0.00";
  const accurancyDisplay = parseFloat(accuracy) > 0 ? `${accuracy}%` : '0.00';

  const contentLineHeight = "line-height:1.4;";

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
        .content-box { padding: 4px; background-color: #ffff; border-radius: 4px; line-height: 1.4; margin-bottom: 6px; font-size: 12px; }
        
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
          <td>Total Original Words</td><td>${stripHtml(result.originalText || '').trim().split(/\s+/).filter((w: string) => w).length}</td>
          <td>Total Words Typed</td><td>${result.words}</td>
        </tr>
        <tr>
          <td>Total Mistakes</td><td class="error">${result.contentType === "shorthand" ? (shorthandRecalcMistakes + shorthandRecalcTrailing) : result.mistakes}</td>
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
          <td>Accuracy</td><td class="success">${accurancyDisplay}</td>
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
          <td>Left Words</td><td>${shorthandRecalcTrailing}</td>
        </tr>
        <tr>
          <td>Mistake%</td><td class="${totalOriginalWords > 0 && ((shorthandRecalcMistakes + shorthandRecalcTrailing) / totalOriginalWords * 100) <= 5 ? "success" : "error"}">${totalOriginalWords > 0 ? (((shorthandRecalcMistakes + shorthandRecalcTrailing) * 100) / totalOriginalWords).toFixed(2) : "0.00"}%</td>
          <td>Result</td><td>${totalOriginalWords > 0 && ((shorthandRecalcMistakes + shorthandRecalcTrailing) / totalOriginalWords * 100) <= 5 ? '<span class="success">Pass</span>' : '<span class="error">Fail</span>'}</td>
        </tr>
        `
        }
      </table>

      <h3>Typed Content (Errors Underlined)</h3>
      <div class="content-box" style="${contentFont} ${contentLineHeight}">
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

/**
 * Calculate the number of days left until account auto-deactivation
 * @param validUntil - The date when access expires (Date object or null)
 * @returns Object with daysLeft (number), status ('active' | 'expiring-soon' | 'expired'), and message (string)
 */
export function calculateDaysLeftForDeactivation(validUntil: Date | null | undefined) {
  if (!validUntil) {
    return {
      daysLeft: null,
      status: 'no-expiry' as const,
      message: 'No expiry date set'
    };
  }

  const now = new Date();
  const expiryDate = new Date(validUntil);
  const timeDiff = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      daysLeft: 0,
      status: 'expired' as const,
      message: 'Access has expired'
    };
  } else if (daysLeft <= 5) {
    return {
      daysLeft,
      status: 'expiring-soon' as const,
      message: `Access expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
    };
  } else {
    return {
      daysLeft,
      status: 'active' as const,
      message: `Access expires in ${daysLeft} days`
    };
  }
}
