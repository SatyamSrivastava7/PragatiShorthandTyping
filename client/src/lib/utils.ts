import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Result } from "./store";

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
    
    if (original === typed) {
      continue;
    }
    
    // Word mismatch logic
    // check punctuation specific
    const cleanOriginal = original.replace(/[.,]/g, '');
    const cleanTyped = typed.replace(/[.,]/g, '');
    
    if (cleanOriginal !== cleanTyped) {
      // The word itself is wrong
      mistakes += 1;
    } else {
      // Word is correct, check punctuation
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
    
    if (cleanOriginal !== cleanTyped) {
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
  const allowedMistakes = totalWordsTyped * 0.05; // 5% rule
  const isPassed = mistakes <= allowedMistakes;

  return {
    words: totalWordsTyped,
    mistakes,
    result: isPassed ? 'Pass' : 'Fail' as 'Pass' | 'Fail'
  };
}

export const generateResultPDF = (result: Result) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Pragati Shorthand and Typing", 105, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Student Report: ${result.studentName} (${result.studentId})`, 14, 25);
  doc.text(`Test: ${result.contentTitle} (${result.contentType.toUpperCase()})`, 14, 32);
  doc.text(`Language: ${result.language?.toUpperCase() || 'ENGLISH'}`, 14, 39);
  doc.text(`Date: ${format(new Date(result.submittedAt), "PPP p")}`, 14, 46);

  if (result.contentType === 'typing') {
    const data = [
      ["Metric", "Value"],
      ["Words Typed", result.metrics.words.toString()],
      ["Time Allocated", `${result.metrics.time} min`],
      ["Mistakes", result.metrics.mistakes.toString()],
      ["Backspaces", result.metrics.backspaces.toString()],
      ["Gross Speed", `${result.metrics.grossSpeed} WPM`],
      ["Net Speed", `${result.metrics.netSpeed} WPM`]
    ];
    
    autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Value']],
      body: data.slice(1),
    });
    
  } else {
    const data = [
      ["Metric", "Value"],
      ["Words Typed", result.metrics.words.toString()],
      ["Time Allocated", `${result.metrics.time} min`],
      ["Mistakes", result.metrics.mistakes.toString()],
      ["Result", result.metrics.result || "N/A"]
    ];
     autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Value']],
      body: data.slice(1),
    });
  }

  // Add Original Content
  let finalY = (doc as any).lastAutoTable.finalY || 52;
  doc.setFontSize(10);
  doc.text("Original Content:", 14, finalY + 10);
  const splitOriginal = doc.splitTextToSize(result.originalText || "", 180);
  doc.text(splitOriginal, 14, finalY + 17);
  
  finalY = finalY + 17 + (splitOriginal.length * 4); // Update Y based on original text lines

  // Add Typed Content with basic error marking (since actual color highlighting per word in PDF is complex in client-side JS without heavy libs)
  // We will simply list the diff analysis below the text.
  
  doc.text("Typed Content:", 14, finalY + 10);
  const splitTyped = doc.splitTextToSize(result.typedText, 180);
  doc.text(splitTyped, 14, finalY + 17);
  
  finalY = finalY + 17 + (splitTyped.length * 4);

  // Detailed Error Analysis
  doc.setTextColor(220, 38, 38); // Red
  doc.text("Error Analysis:", 14, finalY + 10);
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0); // Black
  
  // Calculate Diff for report
  const originalWords = (result.originalText || "").trim().split(/\s+/);
  const typedWords = result.typedText.trim().split(/\s+/);
  const maxLength = Math.max(originalWords.length, typedWords.length);
  
  let errorLog = [];
  for (let i = 0; i < maxLength; i++) {
    const orig = originalWords[i] || "";
    const type = typedWords[i] || "";
    if (orig !== type) {
      // Basic check
       const cleanOrig = orig.replace(/[.,]/g, '');
       const cleanType = type.replace(/[.,]/g, '');
       
       if (cleanOrig !== cleanType) {
         errorLog.push(`Word ${i+1}: Expected "${orig}", Typed "${type}"`);
       } else {
         // Punctuation error
         if (orig.includes(',') !== type.includes(',')) errorLog.push(`Word ${i+1}: Comma mismatch in "${type}"`);
         if (orig.includes('.') !== type.includes('.')) errorLog.push(`Word ${i+1}: Period mismatch in "${type}"`);
       }
    }
  }

  if (errorLog.length > 0) {
    const errorText = errorLog.slice(0, 50).join("\n"); // Limit to first 50 errors to avoid overflow
    const splitErrors = doc.splitTextToSize(errorText + (errorLog.length > 50 ? `\n...and ${errorLog.length - 50} more errors.` : ""), 180);
    doc.text(splitErrors, 14, finalY + 17);
  } else {
     doc.setTextColor(22, 163, 74); // Green
     doc.text("Perfect! No errors found.", 14, finalY + 17);
  }

  doc.save(`result_${result.studentId}_${result.id}.pdf`);
};
