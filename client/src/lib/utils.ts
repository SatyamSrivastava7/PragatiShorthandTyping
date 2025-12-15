import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
  const allowedMistakes = totalWordsTyped * 0.05; // 5% rule
  const isPassed = mistakes <= allowedMistakes;

  return {
    words: totalWordsTyped,
    mistakes,
    result: isPassed ? 'Pass' : 'Fail' as 'Pass' | 'Fail'
  };
}

export const generateResultPDF = async (result: Result) => {
  // Create a temporary container for the report
  const container = document.createElement("div");
  container.style.position = "fixed"; 
  container.style.left = "-10000px"; // Off-screen instead of invisible
  container.style.top = "0";
  container.style.zIndex = "1000"; 
  // container.style.opacity = "0"; // Removed opacity hidden
  container.style.width = "800px"; // Fixed width for A4 consistency
  container.style.backgroundColor = "white";
  container.style.padding = "40px";
  container.style.fontFamily = "Arial, sans-serif";
  
  // Font selection based on language
  const contentFont = result.language === 'hindi' ? 
    "font-family: 'Mangal', 'Tiro Devanagari Hindi', 'Mukta', sans-serif;" : 
    "font-family: 'Times New Roman', Times, serif;";

  // Build the HTML content
  let html = `
    <div style="border: 2px solid #000; padding: 20px; min-height: 1000px; color: black; background: white;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1e3a8a; font-size: 28px; margin-bottom: 5px;">Pragati Institute of Professional Studies</h1>
        <p style="font-size: 16px; color: #555;">Prayagraj</p>
        <h2 style="font-size: 22px; margin-top: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">Test Result Report</h2>
      </div>

      <div style="margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold;">Student Name:</td>
            <td style="padding: 8px;">${result.studentName}</td>
            <td style="padding: 8px; font-weight: bold;">Student ID:</td>
            <td style="padding: 8px;">${result.studentId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Test Title:</td>
            <td style="padding: 8px;">${result.contentTitle}</td>
            <td style="padding: 8px; font-weight: bold;">Date:</td>
            <td style="padding: 8px;">${format(new Date(result.submittedAt), "PPP p")}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Type:</td>
            <td style="padding: 8px; text-transform: capitalize;">${result.contentType}</td>
            <td style="padding: 8px; font-weight: bold;">Language:</td>
            <td style="padding: 8px; text-transform: capitalize;">${result.language}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-weight: bold;">Performance Metrics</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Metric</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Mistakes</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;">${result.metrics.mistakes}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Total Words Typed</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${result.metrics.words}</td>
            </tr>
  `;

  if (result.contentType === 'typing') {
    html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Net Speed</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #15803d;">${result.metrics.netSpeed} WPM</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Gross Speed</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${result.metrics.grossSpeed} WPM</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Backspaces</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${result.metrics.backspaces}</td>
            </tr>
    `;
  } else {
    html += `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Result</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${result.metrics.result === 'Pass' ? '#15803d' : '#dc2626'};">${result.metrics.result}</td>
            </tr>
    `;
  }

  html += `
          </tbody>
        </table>
      </div>
  `;

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
      // Refined check for punctuation
      const cleanOriginal = original.replace(/[.,]/g, '');
      const cleanTyped = typed.replace(/[.,]/g, '');
      
      if (cleanOriginal.toLowerCase() === cleanTyped.toLowerCase()) {
         // Word correct, punct wrong - still error but maybe different style? 
         // For now treat as error
         isError = true;
      }
    }
    
    if (isError) {
      typedHtml += `<span style="text-decoration: underline; text-decoration-color: red; text-decoration-thickness: 2px; color: #dc2626; -webkit-print-color-adjust: exact;">${typed}</span> `;
    } else {
      typedHtml += `<span>${typed}</span> `;
    }
  }

  html += `
      <div style="margin-bottom: 30px;">
        <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Typed Content (Errors Underlined)</h3>
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 4px; line-height: 1.8; ${contentFont}">
          ${typedHtml}
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; font-weight: bold;">Original Content</h3>
        <div style="padding: 15px; background-color: #f9fafb; border-radius: 4px; line-height: 1.8; ${contentFont}">
          ${result.originalText}
        </div>
      </div>
      
      <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #999;">
        <p>Generated by Pragati Institute Portal</p>
        <p>${format(new Date(), "PPP")}</p>
      </div>
    </div>
  `;

  container.innerHTML = html;
  document.body.appendChild(container);

  // Slight delay to ensure rendering
  await new Promise(r => setTimeout(r, 500));

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // Higher resolution
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    // Split into pages if too long (basic implementation)
    // For now, we scale to fit if it's one page, or just add page. 
    // Since auto-paging image is hard, let's just stick to single long image for now 
    // or we'd need to slice canvas.
    // Given most tests are 1-2 pages, let's try to fit or split.
    
    if (pdfHeight > pdf.internal.pageSize.getHeight()) {
       // Multi-page logic for image is tricky, let's just add it and let jsPDF handle it or scale it down?
       // Scaling down makes it unreadable.
       // Let's just create a very long PDF page? No, standard A4.
       
       // Fallback: If it's too long, we might need a better library or just let it cut off for now.
       // However, to fix "could not generate", we just ensure no errors are thrown.
       
       // For a robust solution, we'll iterate.
       let heightLeft = pdfHeight;
       let position = 0;
       
       pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
       heightLeft -= pdf.internal.pageSize.getHeight();
       
       while (heightLeft >= 0) {
         position = heightLeft - pdfHeight;
         pdf.addPage();
         pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
         heightLeft -= pdf.internal.pageSize.getHeight();
       }
    } else {
       pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }
    
    pdf.save(`result_${result.studentId}_${result.id}.pdf`);
  } catch (error) {
    console.error("PDF Generation failed", error);
    alert("Could not generate PDF. Please try again.");
  } finally {
    document.body.removeChild(container);
  }
};
