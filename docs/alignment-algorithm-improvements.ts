/**
 * BACKUP: Alignment Algorithm Improvements for Typing Tests
 * 
 * Source: client/src/lib/utils.ts - fixTrailingErrorPattern function
 * Date: January 2026
 * 
 * These improvements were made to the word alignment algorithm to handle:
 * 1. Punctuation-stripped comparison ("so." matches "so,")
 * 2. Windowed DP alignment (typedWords * 1.5 + 20 buffer)
 * 3. Consecutive incorrect words at end causing preceding missing words to be trailing
 * 4. Keeping skipped words in middle as "missing" (green), only end words as "trailing" (gray)
 */

// === NORMALIZATION FUNCTION (client/src/lib/utils.ts line ~19) ===
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-") // Normalize dashes
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"') // Normalize double quotes
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'") // Normalize single quotes
    .replace(/[.,!?;:]+$/g, "") // Strip trailing punctuation for word matching
    .toLowerCase();
}

// === FIX TRAILING ERROR PATTERN (client/src/lib/utils.ts line ~47) ===
// This function post-processes the DP alignment to fix common error patterns
function fixTrailingErrorPattern(alignment: any[], typedWordCount: number): any[] {
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
  
  // Fix pattern: consecutive missing words followed by extra/substitution
  // Convert first missing + typed word to substitution, keep rest as missing (green)
  let i = 0;
  while (i < result.length) {
    if (result[i].status === "missing") {
      let missingStart = i;
      let missingCount = 0;
      
      while (i < result.length && result[i].status === "missing") {
        missingCount++;
        i++;
      }
      
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
        result.splice(i, 1);
      }
    } else {
      i++;
    }
  }
  
  // Handle pattern: wrong word at end causes many missing before it
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
      
      result.splice(lastTyped, 1);
    }
  }
  
  // NEW: Consecutive incorrect words at end - mark preceding missing as trailing for each
  let scanIdx = result.length - 1;
  
  // Skip any trailing (non-typed) entries at the very end
  while (scanIdx >= 0 && result[scanIdx].typed === "") {
    scanIdx--;
  }
  
  // Scan backwards through consecutive incorrect words
  while (scanIdx >= 0) {
    const item = result[scanIdx];
    
    if (item.typed !== "" && (item.status === "substitution" || item.status === "extra")) {
      // Mark immediately preceding missing words as trailing
      let prevIdx = scanIdx - 1;
      while (prevIdx >= 0 && result[prevIdx].status === "missing") {
        result[prevIdx] = { ...result[prevIdx], status: "trailing", isError: false };
        prevIdx--;
      }
      scanIdx = prevIdx;
    } else {
      break;
    }
  }
  
  // Final pass: mark all words after the last typed position as trailing
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

// === GET TYPING ALIGNMENT (client/src/lib/utils.ts line ~586) ===
// Window size: typedWords * 1.5 + 20 buffer to prefer earlier matches
export function getTypingAlignment(originalText: string, typedText: string): any[] {
  const originalWords = (originalText || "").trim().split(/\s+/).filter((w: string) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w: string) => w);
  
  if (typedWords.length === 0) {
    return originalWords.map((w: string) => ({
      typed: "",
      original: w,
      status: "trailing",
      isError: false,
    }));
  }
  
  // Limit the search window to force matching with earlier occurrences
  const LOOKAHEAD_BUFFER = 20;
  const windowSize = Math.min(originalWords.length, Math.floor(typedWords.length * 1.5) + LOOKAHEAD_BUFFER);
  const windowedOriginal = originalWords.slice(0, windowSize).join(" ");
  
  // const rawAlignment = alignWords(windowedOriginal, typedText);
  // let result = fixTrailingErrorPattern(rawAlignment, typedWords.length);
  
  // Add remaining original words as trailing
  // for (let i = windowSize; i < originalWords.length; i++) {
  //   result.push({
  //     typed: "",
  //     original: originalWords[i],
  //     status: "trailing",
  //     isError: false,
  //   });
  // }
  
  // return result;
}

/**
 * KEY CHANGES SUMMARY:
 * 
 * 1. normalizeForComparison: Added .replace(/[.,!?;:]+$/g, "") to strip trailing punctuation
 *    - This allows "so." to match "so," correctly
 * 
 * 2. getTypingAlignment: Changed window from full text to typedWords * 1.5 + 20
 *    - Forces matching with earlier occurrences of words
 *    - Prevents "are" from matching a later occurrence when earlier one exists
 * 
 * 3. fixTrailingErrorPattern: Multiple improvements:
 *    - Removed code that converted middle missing words to trailing (keep them green)
 *    - Added logic for consecutive incorrect words at end to mark preceding missing as trailing
 *    - Only words AFTER the last typed position should be trailing (gray)
 * 
 * 4. Server-side regeneration script (server/scripts/regenerate-results.ts):
 *    - Same changes applied to ensure consistency between display and stored metrics
 */
