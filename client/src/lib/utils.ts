import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Result } from "@shared/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateTypingMetrics(originalText: string, typedText: string, timeInMinutes: number, backspaces: number) {
  // Normalize text: remove extra spaces, but keep structure mostly intact for word comparison
  const originalWords = originalText.trim().split(/\s+/);
  const typedWords = typedText.trim().split(/\s+/);
  
  let mistakes = 0;
  
  // Prompt specific rules:
  // 1 wrong word = 1 mistake
  // 1 wrong ',' = 0.25 mistakes
  // 1 wrong '.' = 1 mistake
  // 1 skipped word = 1 mistake
  // 1 extra word = 1 mistake
  
  const maxLength = Math.max(originalWords.length, typedWords.length);
  
  for (let i = 0; i < maxLength; i++) {
    const original = originalWords[i] || "";
    const typed = typedWords[i] || "";
    
    if (!original && typed) {
      // Extra word
      mistakes += 1;
      continue;
    }
    
    if (original && !typed) {
      // Skipped word
      mistakes += 1;
      continue;
    }
    
    // Case-insensitive comparison for word content
    if (original.toLowerCase() === typed.toLowerCase()) {
      continue;
    }
    
    // Word mismatch logic
    // check punctuation specific
    const cleanOriginal = original.replace(/[.,]/g, '');
    const cleanTyped = typed.replace(/[.,]/g, '');
    
    if (cleanOriginal.toLowerCase() !== cleanTyped.toLowerCase()) {
      // The word itself is wrong
      mistakes += 1;
    } else {
      // Word is correct (case-insensitive), check punctuation
      // Check commas
      const originalCommas = (original.match(/,/g) || []).length;
      const typedCommas = (typed.match(/,/g) || []).length;
      mistakes += Math.abs(originalCommas - typedCommas) * 0.25;
      
      // Check periods
      const originalPeriods = (original.match(/\./g) || []).length;
      const typedPeriods = (typed.match(/\./g) || []).length;
      mistakes += Math.abs(originalPeriods - typedPeriods) * 1; // 1 mistake per wrong period
    }
  }

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
    backspaces
  };
}

export function calculateShorthandMetrics(originalText: string, typedText: string, timeInMinutes: number) {
  const originalWords = originalText.trim().split(/\s+/);
  const typedWords = typedText.trim().split(/\s+/);
  
  let mistakes = 0;
  
  // Updated Logic: Count words while checking for mistakes, not character. 
  // Match exact words and count 1 wrong word = 1 mistake; 
  // 1 wrong /missed / extra ',' = 0.25 mistakes; 
  // 1 wrong /missed / extra '.' = 1 mistake; 
  // 1 skipped word = 1 mistake; 
  // 1 extra word = 1 mistake; 

  const maxLength = Math.max(originalWords.length, typedWords.length);
  
  for (let i = 0; i < maxLength; i++) {
    const original = originalWords[i] || "";
    const typed = typedWords[i] || "";
    
    if (!original && typed) {
      // Extra word
      mistakes += 1;
      continue;
    }
    
    if (original && !typed) {
      // Skipped word
      mistakes += 1;
      continue;
    }
    
    // Check main word content excluding punctuation
    const cleanOriginal = original.replace(/[.,]/g, '');
    const cleanTyped = typed.replace(/[.,]/g, '');
    
    // Case-insensitive comparison
    if (cleanOriginal.toLowerCase() !== cleanTyped.toLowerCase()) {
       // Wrong word
       mistakes += 1;
    } else {
       // Word matches, check punctuation penalties
       // Check commas (0.25 per mismatch)
       const originalCommas = (original.match(/,/g) || []).length;
       const typedCommas = (typed.match(/,/g) || []).length;
       mistakes += Math.abs(originalCommas - typedCommas) * 0.25;
       
       // Check periods (1 per mismatch)
       const originalPeriods = (original.match(/\./g) || []).length;
       const typedPeriods = (typed.match(/\./g) || []).length;
       mistakes += Math.abs(originalPeriods - typedPeriods) * 1;
    }
  }

  const totalWordsTyped = typedText.trim() === '' ? 0 : typedWords.length;
  // 5% rule: More than 5% mistakes = Fail, 5% or less = Pass
  const mistakePercentage = totalWordsTyped > 0 ? (mistakes / totalWordsTyped) * 100 : 0;
  const isPassed = mistakePercentage <= 5;

  return {
    words: totalWordsTyped,
    mistakes,
    result: isPassed ? 'Pass' : 'Fail' as 'Pass' | 'Fail'
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

  // Compare text to find errors for highlighting
  const originalWords = (result.originalText || "").trim().split(/\s+/);
  const typedWords = result.typedText.trim().split(/\s+/);
  const maxLength = Math.max(originalWords.length, typedWords.length);
  
  let typedHtml = "";
  
  for (let i = 0; i < maxLength; i++) {
    const original = originalWords[i] || "";
    const typed = typedWords[i] || "";
    
    let isError = false;
    
    if (original.toLowerCase() !== typed.toLowerCase()) {
      isError = true;
      const cleanOriginal = original.replace(/[.,]/g, '');
      const cleanTyped = typed.replace(/[.,]/g, '');
      
      if (cleanOriginal.toLowerCase() === cleanTyped.toLowerCase()) {
         isError = true;
      }
    }
    
    if (isError) {
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${typed}</span> `;
    } else {
      typedHtml += `<span>${typed}</span> `;
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
        h2 { font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 8px; margin-bottom: 8px; text-align: center; }
        h3 { font-size: 14px; margin: 16px 0 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        td { padding: 4px 6px; vertical-align: top; }
        .label { font-weight: bold; width: 100px; }
        .metrics-table th, .metrics-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        .metrics-table th { background-color: #f8fafc; }
        .content-box { padding: 4px; background-color: #f9fafb; border-radius: 4px; line-height: 1; margin-bottom: 6px; font-size: 13px; white-space: pre-wrap; }
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
