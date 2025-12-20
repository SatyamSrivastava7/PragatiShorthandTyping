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

// Normalize dashes/hyphens to standard hyphen for comparison
// Handles: − (minus U+2212), – (en dash U+2013), — (em dash U+2014), ‐ (hyphen U+2010), etc.
function normalizeForComparison(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-") // Normalize all dash-like characters to hyphen
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

  // Build LCS table for normalized comparison (case-insensitive, dash-normalized)
  const m = originalWords.length;
  const n = typedWords.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (
        normalizeForComparison(originalWords[i - 1]) ===
        normalizeForComparison(typedWords[j - 1])
      ) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build alignment
  const result: AlignmentEntry[] = [];
  let i = m,
    j = n;
  const tempResult: AlignmentEntry[] = [];

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      normalizeForComparison(originalWords[i - 1]) ===
        normalizeForComparison(typedWords[j - 1])
    ) {
      // Match
      tempResult.push({
        typed: typedWords[j - 1],
        original: originalWords[i - 1],
        status: "match",
        isError: false,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Extra typed word (not in original) or substitution
      tempResult.push({
        typed: typedWords[j - 1],
        original: "",
        status: "extra",
        isError: true,
      });
      j--;
    } else {
      // Missing original word
      tempResult.push({
        typed: "",
        original: originalWords[i - 1],
        status: "missing",
        isError: true,
      });
      i--;
    }
  }

  // Reverse to get correct order
  tempResult.reverse();

  // Post-process: pair up extra and missing words into substitutions
  // Each missing word should try to pair with the closest unpaired extra word
  const extras: { index: number; entry: AlignmentEntry }[] = [];
  const missings: { index: number; entry: AlignmentEntry }[] = [];

  for (let k = 0; k < tempResult.length; k++) {
    if (tempResult[k].status === "extra") {
      extras.push({ index: k, entry: tempResult[k] });
    } else if (tempResult[k].status === "missing") {
      missings.push({ index: k, entry: tempResult[k] });
    }
  }

  // Pair extras with missings as substitutions - find closest unpaired extra for each missing
  const paired = new Set<number>();
  for (const missing of missings) {
    // Find the closest unpaired extra (prefer before, then after)
    let bestExtra: { index: number; entry: AlignmentEntry } | null = null;
    let bestDistance = Infinity;

    for (const extra of extras) {
      if (paired.has(extra.index)) continue;
      const distance = Math.abs(extra.index - missing.index);
      // Only consider extras that are reasonably close (within 3 positions)
      // and prefer extras that come before the missing word
      if (distance < bestDistance && distance <= 3) {
        bestDistance = distance;
        bestExtra = extra;
      }
    }

    if (bestExtra) {
      paired.add(bestExtra.index);
      paired.add(missing.index);
      // Mark them for merging - put at the missing's position (original word position)
      tempResult[missing.index] = {
        typed: bestExtra.entry.typed,
        original: missing.entry.original,
        status: "substitution",
        isError: true,
      };
      tempResult[bestExtra.index] = {
        typed: "",
        original: "",
        status: "match",
        isError: false,
      }; // Will be filtered out
    }
  }

  // Build final result, filtering out empty placeholder entries
  for (const entry of tempResult) {
    if (entry.typed === "" && entry.original === "" && entry.status === "match")
      continue;
    result.push(entry);
  }

  return result;
}

// Calculate mistakes using aligned words with status-based counting
// Only considers the portion of text the student attempted to type
// Trailing missing words (untyped portion) are NOT counted as mistakes
export function calculateAlignedMistakes(
  originalText: string,
  typedText: string,
): { mistakes: number; alignment: AlignmentEntry[]; attemptedAlignment: AlignmentEntry[] } {
  const alignment = alignWords(originalText, typedText);

  // Find the last position where student typed something (match, substitution, or extra)
  // This determines the "attempted portion" - we ignore trailing missing words
  let lastTypedIndex = -1;
  for (let i = alignment.length - 1; i >= 0; i--) {
    if (alignment[i].typed !== "") {
      lastTypedIndex = i;
      break;
    }
  }

  // Only consider alignment up to the last typed word
  // This excludes trailing missing words that the student didn't get to
  const attemptedAlignment = lastTypedIndex >= 0 
    ? alignment.slice(0, lastTypedIndex + 1)
    : [];

  let mistakes = 0;

  for (let idx = 0; idx < attemptedAlignment.length; idx++) {
    const item = attemptedAlignment[idx];
    
    // Missing words count as 1 mistake each (only within attempted portion)
    if (item.status === "missing") {
      const hasTrailingComma = item.original.endsWith(',');
      
      if (hasTrailingComma) {
        mistakes += 1.25;
      } else {
        mistakes += 1;
      }
      continue;
    }

    // Extra words count as 1 mistake each
    if (item.status === "extra") {
      mistakes += 1;
      continue;
    }

    // Substitutions - check if it's just punctuation difference
    if (item.status === "substitution") {
      const cleanOriginal = item.original.replace(/[.,]/g, "");
      const cleanTyped = item.typed.replace(/[.,]/g, "");

      if (cleanOriginal.toLowerCase() !== cleanTyped.toLowerCase()) {
        mistakes += 1;
      } else {
        const origTrailingComma = item.original.endsWith(',') ? 1 : 0;
        const typedTrailingComma = item.typed.endsWith(',') ? 1 : 0;
        
        if (origTrailingComma !== typedTrailingComma) {
          mistakes += 0.25;
        }

        const origTrailingPeriod = item.original.endsWith('.') ? 1 : 0;
        const typedTrailingPeriod = item.typed.endsWith('.') ? 1 : 0;
        
        if (origTrailingPeriod !== typedTrailingPeriod) {
          mistakes += 1;
        }
      }
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
  const typedWords = typedText
    .trim()
    .split(/\s+/)
    .filter((w) => w);

  const totalWordsTyped = typedWords.length;
  // Use words count, not length of array if empty
  const wordCount = typedText.trim() === "" ? 0 : totalWordsTyped;

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

  return {
    words: wordCount,
    mistakes,
    grossSpeed: formatSpeed(grossSpeed),
    netSpeed: formatSpeed(netSpeed),
    backspaces,
    missingWords,
  };
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
  const typedWords = typedText
    .trim()
    .split(/\s+/)
    .filter((w) => w);

  const totalWordsTyped = typedText.trim() === "" ? 0 : typedWords.length;
  // 5% rule: More than 5% mistakes = Fail, 5% or less = Pass
  const mistakePercentage =
    totalWordsTyped > 0 ? (mistakes / totalWordsTyped) * 100 : 0;
  const isPassed = mistakePercentage <= 5;

  // Count missing words only from attempted portion (not trailing untyped words)
  const missingWords = attemptedAlignment.filter((a) => a.status === "missing").length;

  return {
    words: totalWordsTyped,
    mistakes,
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

  // Use LCS-based alignment for accurate error detection with positional missing words
  // Only show the attempted portion (excludes trailing untyped words)
  const { attemptedAlignment } = calculateAlignedMistakes(result.originalText || "", result.typedText);
  const originalWords = (result.originalText || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  const typedWords = result.typedText
    .trim()
    .split(/\s+/)
    .filter((w) => w);

  let typedHtml = "";

  for (const item of attemptedAlignment) {
    if (item.status === "missing") {
      // Missing word - show in green brackets at correct position
      typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${item.original}]</span> `;
    } else if (item.status === "substitution") {
      // Wrong word - show underlined in red with correct word in green brackets
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${item.typed}</span>`;
      typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${item.original}]</span> `;
    } else if (item.status === "extra") {
      // Extra typed word - show underlined in red
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
        .content-box { padding: 4px; background-color: #f9fafb; border-radius: 4px; line-height: 1.4; margin-bottom: 6px; font-size: 12px; white-space: pre-wrap; }
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
          <th>Metric</th><th>Value</th>
        </tr>
        <tr>
          <td>Total Original Words</td><td>${originalWords.length}</td>
        </tr>
        <tr>
          <td>Total Words Typed</td><td>${result.words}</td>
        </tr>
        <tr>
          <td>Mistakes</td><td class="error">${result.mistakes}</td>
        </tr>
        <tr>
          <td>Missing Words</td><td class="error">${attemptedAlignment.filter((a) => a.status === "missing").length}</td>
        </tr>
        ${
          result.contentType === "typing"
            ? `
        <tr>
          <td>Backspaces</td><td>${result.backspaces}</td>
        </tr>
        <tr>
          <td>Accuracy</td><td class="success">${(result.words - parseInt(result.mistakes))*100/result.words} WPM</td>
        </tr>
        <tr>
          <td>Gross Speed</td><td>${result.grossSpeed} WPM</td>
        </tr>
          <tr>
            <td>Net Speed</td><td class="success">${result.netSpeed} WPM</td>
          </tr>
        `
            : `
          <tr>
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
