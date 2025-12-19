import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Result } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Special characters that can split words (user types them as spaces)
// Includes: hyphen, en-dash, em-dash, forward slash, backslash, underscore, 
// colon, semicolon, pipe, plus, ampersand, tilde, etc.
const SPLIT_CHAR_PATTERN = /[-–—\/\\:;|+&_~]/;

// Split a word by special characters and return parts
function splitBySpecialChars(word: string): string[] {
  return word.split(SPLIT_CHAR_PATTERN).filter(p => p);
}

// Check if word contains any special split characters
function hasSplitChars(word: string): boolean {
  return SPLIT_CHAR_PATTERN.test(word);
}

// Align typed words with original words to handle word splits/joins
// Returns an array of { typed, original, isError } for each typed word
export function alignWords(originalText: string, typedText: string): Array<{ typed: string; original: string; isError: boolean }> {
  const originalWords = (originalText || "").trim().split(/\s+/).filter(w => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter(w => w);
  
  const result: Array<{ typed: string; original: string; isError: boolean }> = [];
  
  let origIdx = 0;
  let typedIdx = 0;
  let partIdx = 0; // Track which part of a compound word we're matching
  let currentParts: string[] = []; // Parts of current compound word being matched
  
  while (typedIdx < typedWords.length) {
    const typed = typedWords[typedIdx];
    const original = originalWords[origIdx] || "";
    
    // Exact match (case-insensitive)
    if (original && original.toLowerCase() === typed.toLowerCase()) {
      result.push({ typed, original, isError: false });
      origIdx++;
      typedIdx++;
      partIdx = 0;
      currentParts = [];
      continue;
    }
    
    // Check if we're in the middle of matching a compound word
    if (currentParts.length > 0 && partIdx < currentParts.length) {
      const expectedPart = currentParts[partIdx];
      if (expectedPart.toLowerCase() === typed.toLowerCase()) {
        // This typed word matches the next part of the compound
        const isLastPart = partIdx === currentParts.length - 1;
        result.push({ typed, original: "", isError: true });
        typedIdx++;
        partIdx++;
        
        if (isLastPart) {
          // Finished matching all parts of compound word
          origIdx++;
          partIdx = 0;
          currentParts = [];
        }
        continue;
      }
    }
    
    // Check if original contains special characters (compound word)
    if (hasSplitChars(original)) {
      const parts = splitBySpecialChars(original);
      const typedLower = typed.toLowerCase();
      
      // Check if typed word matches the first part
      if (parts.length > 0 && parts[0].toLowerCase() === typedLower) {
        // Start matching a compound word
        currentParts = parts;
        partIdx = 1; // Already matched first part, expect second next
        result.push({ typed, original, isError: true });
        typedIdx++;
        
        // If only one part, we're done with this compound word
        if (parts.length === 1) {
          origIdx++;
          partIdx = 0;
          currentParts = [];
        }
        continue;
      }
      
      // Check if typed word matches any part (for realignment)
      const matchedPartIndex = parts.findIndex(p => p.toLowerCase() === typedLower);
      if (matchedPartIndex !== -1) {
        currentParts = parts;
        partIdx = matchedPartIndex + 1;
        
        if (matchedPartIndex === 0) {
          result.push({ typed, original, isError: true });
        } else {
          result.push({ typed, original: "", isError: true });
        }
        
        typedIdx++;
        
        // If matched last part, advance to next original word
        if (matchedPartIndex === parts.length - 1) {
          origIdx++;
          partIdx = 0;
          currentParts = [];
        }
        continue;
      }
    }
    
    // Look ahead to see if we can realign
    // Check if current typed word matches any upcoming original word
    let foundAhead = false;
    for (let lookAhead = 1; lookAhead <= 3 && origIdx + lookAhead < originalWords.length; lookAhead++) {
      if (originalWords[origIdx + lookAhead].toLowerCase() === typed.toLowerCase()) {
        // We found a match ahead - mark skipped originals and current as correct
        // The current mismatch is likely due to word splits
        result.push({ typed, original: originalWords[origIdx + lookAhead], isError: false });
        origIdx = origIdx + lookAhead + 1;
        typedIdx++;
        foundAhead = true;
        partIdx = 0;
        currentParts = [];
        break;
      }
    }
    
    if (foundAhead) continue;
    
    // No match found - this is an error
    result.push({ typed, original, isError: original.toLowerCase() !== typed.toLowerCase() });
    if (original) origIdx++;
    typedIdx++;
    partIdx = 0;
    currentParts = [];
  }
  
  return result;
}

// Calculate mistakes using aligned words
export function calculateAlignedMistakes(originalText: string, typedText: string): { mistakes: number; alignment: Array<{ typed: string; original: string; isError: boolean }> } {
  const originalWords = (originalText || "").trim().split(/\s+/).filter(w => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter(w => w);
  const alignment = alignWords(originalText, typedText);
  
  let mistakes = 0;
  
  for (const { typed, original, isError } of alignment) {
    if (!isError) continue;
    
    // Clean words for comparison (remove punctuation)
    const cleanOriginal = original.replace(/[.,]/g, '');
    const cleanTyped = typed.replace(/[.,]/g, '');
    
    if (cleanOriginal.toLowerCase() !== cleanTyped.toLowerCase()) {
      // Word itself is wrong
      mistakes += 1;
    } else {
      // Word matches, check punctuation
      const originalCommas = (original.match(/,/g) || []).length;
      const typedCommas = (typed.match(/,/g) || []).length;
      mistakes += Math.abs(originalCommas - typedCommas) * 0.25;
      
      const originalPeriods = (original.match(/\./g) || []).length;
      const typedPeriods = (typed.match(/\./g) || []).length;
      mistakes += Math.abs(originalPeriods - typedPeriods) * 1;
    }
  }
  
  // Add mistakes for skipped words (original words not covered)
  const coveredOriginals = alignment.filter(a => a.original).length;
  const skippedWords = Math.max(0, originalWords.length - coveredOriginals);
  mistakes += skippedWords;
  
  return { mistakes, alignment };
}

export function calculateTypingMetrics(originalText: string, typedText: string, timeInMinutes: number, backspaces: number) {
  // Use aligned word comparison to handle word splits/joins
  const { mistakes } = calculateAlignedMistakes(originalText, typedText);
  const typedWords = typedText.trim().split(/\s+/).filter(w => w);
  const originalWords = originalText.trim().split(/\s+/).filter(w => w);

  const totalWordsTyped = typedWords.length;
  // Use words count, not length of array if empty
  const wordCount = typedText.trim() === '' ? 0 : totalWordsTyped;
  
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

  // Calculate missing words (words in original that weren't typed)
  const missingWords = Math.max(0, originalWords.length - typedWords.length);

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
    missingWords
  };
}

export function calculateShorthandMetrics(originalText: string, typedText: string, timeInMinutes: number) {
  // Use aligned word comparison to handle word splits/joins
  const { mistakes } = calculateAlignedMistakes(originalText, typedText);
  const originalWords = originalText.trim().split(/\s+/).filter(w => w);
  const typedWords = typedText.trim().split(/\s+/).filter(w => w);

  const totalWordsTyped = typedText.trim() === '' ? 0 : typedWords.length;
  // 5% rule: More than 5% mistakes = Fail, 5% or less = Pass
  const mistakePercentage = totalWordsTyped > 0 ? (mistakes / totalWordsTyped) * 100 : 0;
  const isPassed = mistakePercentage <= 5;

  // Calculate missing words (words in original that weren't typed)
  const missingWords = Math.max(0, originalWords.length - typedWords.length);

  return {
    words: totalWordsTyped,
    mistakes,
    result: isPassed ? 'Pass' : 'Fail' as 'Pass' | 'Fail',
    missingWords
  };
}

export const generateResultPDF = async (result: Result) => {
  // Generate filename: StudentName_TypeOfResult_Date
  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_');
  const studentName = sanitizeName(result.studentName);
  const resultType = result.contentType.charAt(0).toUpperCase() + result.contentType.slice(1);
  const dateStr = format(new Date(result.submittedAt), "yyyy-MM-dd");
  const fileName = `${studentName}_${resultType}_${dateStr}`;
  
  // Use a completely different approach: browser native print
  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  // Font selection based on language
  const contentFont = result.language === 'hindi' ? 
    "font-family: 'Mangal', 'Tiro Devanagari Hindi', 'Mukta', sans-serif;" : 
    "font-family: 'Times New Roman', Times, serif;";

  // Use aligned word comparison for accurate error detection
  const alignment = alignWords(result.originalText || "", result.typedText);
  const originalWords = (result.originalText || "").trim().split(/\s+/).filter(w => w);
  const typedWords = result.typedText.trim().split(/\s+/).filter(w => w);
  const missingWordsCount = Math.max(0, originalWords.length - typedWords.length);
  const missingWords = missingWordsCount > 0 ? originalWords.slice(-missingWordsCount) : [];
  
  let typedHtml = "";
  
  for (const item of alignment) {
    if (item.isError) {
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${item.typed}</span>`;
      if (item.original) {
        typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${item.original}]</span> `;
      } else {
        typedHtml += ` `;
      }
    } else {
      typedHtml += `<span>${item.typed}</span> `;
    }
  }
  
  // Add missing words at the end in green brackets
  for (const word of missingWords) {
    typedHtml += `<span style="color: #15803d; font-weight: bold; -webkit-print-color-adjust: exact;">[${word}]</span> `;
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
        h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 8px; margin-bottom: 8px; text-align: center; }
        h3 { font-size: 14px; margin: 16px 0 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        td { padding: 4px 6px; vertical-align: top; }
        .label { font-weight: bold; width: 100px; }
        .metrics-table th, .metrics-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .metrics-table th { background-color: #f8fafc; }
        .content-box { padding: 4px; background-color: #f9fafb; border-radius: 4px; line-height: 1; margin-bottom: 6px; font-size: 12px; white-space: pre-wrap; }
        .error { color: #dc2626; font-weight: bold; }
        .success { color: #15803d; font-weight: bold; }
        .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Pragati Institute of Professional Studies</h1>
      <p class="subtitle">Kalindipuram, Prayagraj, 211011</p>
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
          <td>Mistakes</td><td class="error">${result.mistakes}</td>
        </tr>
        <tr>
          <td>Total Words Typed</td><td>${result.words}</td>
        </tr>
        <tr>
          <td>Total Original Words</td><td>${originalWords.length}</td>
        </tr>
        <tr>
          <td>Missing Words</td><td class="error">${Math.max(0, originalWords.length - typedWords.length)}</td>
        </tr>
        ${result.contentType === 'typing' ? `
          <tr>
            <td>Net Speed</td><td class="success">${result.netSpeed} WPM</td>
          </tr>
          <tr>
            <td>Gross Speed</td><td>${result.grossSpeed} WPM</td>
          </tr>
          <tr>
            <td>Backspaces</td><td>${result.backspaces}</td>
          </tr>
        ` : `
          <tr>
            <td>Result</td><td class="${result.result === 'Pass' ? 'success' : 'error'}">${result.result}</td>
          </tr>
        `}
      </table>

      <h3>Typed Content (Errors Underlined)</h3>
      <div class="content-box" style="${contentFont}">
        ${typedHtml}
      </div>

      <h3>Original Content</h3>
      <div class="content-box" style="${contentFont}">
        ${result.originalText}
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
