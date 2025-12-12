import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

  return {
    words: wordCount,
    mistakes,
    grossSpeed: Math.round(grossSpeed),
    netSpeed: Math.round(netSpeed),
    backspaces
  };
}

export function calculateShorthandMetrics(originalText: string, typedText: string, timeInMinutes: number) {
  const originalWords = originalText.trim().split(/\s+/);
  const typedWords = typedText.trim().split(/\s+/);
  
  let mistakes = 0;
  
  const maxLength = Math.max(originalWords.length, typedWords.length);
  for (let i = 0; i < maxLength; i++) {
    if (originalWords[i] !== typedWords[i]) {
      mistakes++;
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
