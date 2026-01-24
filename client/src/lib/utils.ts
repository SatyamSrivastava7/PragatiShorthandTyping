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

// Alignment entry types: match, substitution, missing (skipped original), extra (typed but not in original)
export type AlignmentStatus = "match" | "substitution" | "missing" | "extra";

export interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

// LCS-based word alignment that shows missing words in their correct positions
// With a limited look-ahead window of 20 words to avoid matching too far away
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

  if (originalWords.length === 0 && typedWords.length === 0) return [];
  if (originalWords.length === 0) {
    return typedWords.map((w) => ({
      typed: w,
      original: "",
      status: "extra" as AlignmentStatus,
      isError: true,
    }));
  }
  if (typedWords.length === 0) {
    return originalWords.map((w) => ({
      typed: "",
      original: w,
      status: "missing" as AlignmentStatus,
      isError: true,
    }));
  }

  // Greedy sequential matching with 40-word look-ahead window
  // Matches words sequentially - finds first match within window, then proceeds
  const LOOK_AHEAD_WINDOW = 40;
  const result: AlignmentEntry[] = [];
  let origIndex = 0;
  let typedIndex = 0;

  while (origIndex < originalWords.length || typedIndex < typedWords.length) {
    // If we've exhausted typed words, remaining original words are missing
    if (typedIndex >= typedWords.length) {
      while (origIndex < originalWords.length) {
        result.push({
          typed: "",
          original: originalWords[origIndex],
          status: "missing",
          isError: true,
        });
        origIndex++;
      }
      break;
    }

    // If we've exhausted original words, remaining typed words are extra
    if (origIndex >= originalWords.length) {
      while (typedIndex < typedWords.length) {
        result.push({
          typed: typedWords[typedIndex],
          original: "",
          status: "extra",
          isError: true,
        });
        typedIndex++;
      }
      break;
    }

    const currentTypedWord = normalizeForComparison(typedWords[typedIndex]);
    
    // Look for first match within the window, starting from current position
    let foundMatchAtDistance = -1;

    for (let k = origIndex; k < Math.min(origIndex + LOOK_AHEAD_WINDOW, originalWords.length); k++) {
      if (normalizeForComparison(originalWords[k]) === currentTypedWord) {
        foundMatchAtDistance = k - origIndex;
        break; // Take the FIRST (earliest) match within window
      }
    }

    if (foundMatchAtDistance >= 0) {
      // Mark all words between current position and match as missing
      for (let m = origIndex; m < origIndex + foundMatchAtDistance; m++) {
        result.push({
          typed: "",
          original: originalWords[m],
          status: "missing",
          isError: true,
        });
      }
      
      // Add the match
      result.push({
        typed: typedWords[typedIndex],
        original: originalWords[origIndex + foundMatchAtDistance],
        status: "match",
        isError: false,
      });
      
      origIndex += foundMatchAtDistance + 1;
      typedIndex++;
    } else {
      // No match found within window
      // Mark as substitution (wrong word) but don't advance origIndex yet
      // Try to match next typed word from nearby position first
      result.push({
        typed: typedWords[typedIndex],
        original: originalWords[origIndex],
        status: "substitution",
        isError: true,
      });
      
      typedIndex++;
      
      // Only advance origIndex if there's no next typed word, or if we can't find it nearby
      if (typedIndex < typedWords.length) {
        // Check if next typed word can be found nearby (within 20-word window)
        const nextTypedWord = normalizeForComparison(typedWords[typedIndex]);
        let canFindNextNearby = false;
        
        for (let k = origIndex + 1; k < Math.min(origIndex + LOOK_AHEAD_WINDOW, originalWords.length); k++) {
          if (normalizeForComparison(originalWords[k]) === nextTypedWord) {
            canFindNextNearby = true;
            break;
          }
        }
        
        // Only advance origIndex if we can't find the next typed word nearby
        if (!canFindNextNearby) {
          origIndex++;
        }
      } else {
        // No more typed words, advance origIndex
        origIndex++;
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

export function calculateTypingMetrics(
  originalText: string,
  typedText: string,
  timeInMinutes: number,
  backspaces: number,
) {
  // Use aligned word comparison to handle word splits/joins
  // Only considers the attempted portion (excludes trailing untyped words)
  const { mistakes, attemptedAlignment } = calculateAlignedMistakes(
    originalText,
    typedText,
  );

  // Count words ONLY from the attempted portion (not trailing missed words or extra words)
  const typedWordsInAttempted = attemptedAlignment.filter(
    (a) => a.typed !== "" && a.status !== "missing"
  ).length;

  const totalWordsTyped = typedWordsInAttempted;
  const wordCount = totalWordsTyped;

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

  // Count missing words only from attempted portion (not trailing untyped words)
  const missingWords = attemptedAlignment.filter((a) => a.status === "missing").length;

  // Helper to format to 2 decimal places, removing trailing .00
  const formatSpeed = (speed: number) => {
    const rounded = Math.round(speed * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
  };

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
    words: wordCount,
    mistakes,
    halfMistakes,
    grossSpeed: formatSpeed(grossSpeed),
    netSpeed: formatSpeed(netSpeed),
    backspaces,
    missingWords,
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
  // Only considers the attempted portion (excludes trailing untyped words)
  const { mistakes, attemptedAlignment } = calculateAlignedMistakes(
    originalText,
    typedText,
  );

  // For Shorthand: Calculate metrics based on TOTAL ORIGINAL WORDS (not typed words)
  // Count all original words from the attempted portion
  const totalOriginalWords = attemptedAlignment.filter(
    (a) => a.original !== ""
  ).length;

  // 5% rule: More than 5% mistakes = Fail, 5% or less = Pass
  // Calculate percentage based on TOTAL ORIGINAL WORDS
  const mistakePercentage =
    totalOriginalWords > 0 ? (mistakes / totalOriginalWords) * 100 : 0;
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
    words: totalOriginalWords,
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

  // Use calculateAlignedMistakes to get attemptedAlignment (excludes trailing untyped content)
  // This ensures PDF "Typed Content" shows only what student actually attempted
  const { attemptedAlignment, alignment } = calculateAlignedMistakes(result.originalText || "", result.typedText);

  // Calculate trailing words (words not attempted after the last typed word) - only for shorthand
  let trailingWords: string[] = [];
  if (result.contentType === "shorthand") {
    const trailingItems = alignment.filter((item) => {
      // Find items that are not in attemptedAlignment
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });
    trailingWords = trailingItems.map((item) => item.original).filter((w) => w);
  }

  let typedHtml = "";

  // Use attemptedAlignment to exclude trailing missing words from PDF
  for (let i = 0; i < attemptedAlignment.length; i++) {
    const item = attemptedAlignment[i];
    
    // Check if we've recently shown this word in brackets - if so, skip to avoid duplication
    if (item.status === "missing") {
      const normalizedCurrent = normalizeForComparison(item.original);
      
      // Check if we just showed this word in brackets recently (last 2 items)
      let isDuplicate = false;
      for (let j = Math.max(0, i - 2); j < i; j++) {
        const prevItem = attemptedAlignment[j];
        if (prevItem.status === "missing" && normalizeForComparison(prevItem.original) === normalizedCurrent) {
          isDuplicate = true;
          break;
        }
        if ((prevItem.status === "substitution" || prevItem.status === "match") && 
            normalizeForComparison(prevItem.original) === normalizedCurrent) {
          isDuplicate = true;
          break;
        }
      }
      
      if (isDuplicate) {
        continue; // Skip duplicate bracketed word
      }
      
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
          <td>Total Original Words</td><td>${alignment.filter((a) => a.original !== "").length}</td>
          <td>${result.contentType === "typing" ? "Total Words Typed" : "Total Words Attempted"}</td><td>${result.words}</td>
        </tr>
        <tr>
          <td>Total Mistakes</td><td class="error">${result.mistakes}</td>
          <td>Missing Words</td><td class="error">${attemptedAlignment.filter((a) => a.status === "missing").length}</td>
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
