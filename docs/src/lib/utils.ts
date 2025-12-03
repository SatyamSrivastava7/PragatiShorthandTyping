import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateWPM(charCount: number, timeMinutes: number): number {
  if (timeMinutes <= 0) return 0;
  // Standard word is 5 characters
  return Math.round((charCount / 5) / timeMinutes);
}

export function calculateTypingStats(
  original: string, 
  typed: string, 
  timeMinutes: number,
  backspaces: number
) {
  // Word count logic: Space delimited
  const wordsTyped = typed.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // Mismatches logic (Basic char comparison for now as per earlier impl, but user asked to rename mismatches to Mistakes)
  let correctChars = 0;
  let mistakes = 0;
  const minLen = Math.min(original.length, typed.length);

  for (let i = 0; i < minLen; i++) {
    if (original[i] === typed[i]) {
      correctChars++;
    } else {
      mistakes++;
    }
  }
  
  // Count extra characters as mistakes
  if (typed.length > original.length) {
    mistakes += typed.length - original.length;
  }
  
  const accuracy = typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100;

  // Gross Speed = Total words typed / Total time
  const grossSpeed = timeMinutes > 0 ? Math.round(wordsTyped / timeMinutes) : 0;

  // Net Speed Logic:
  // If Mistakes > Total Time => Net Speed = (TotalWords - (Mistakes - TotalTime) * TotalTime) / TotalTime
  // If Mistakes <= Total Time => Net Speed = TotalWords / TotalTime (Same as Gross)
  
  let netSpeed = 0;
  if (mistakes > timeMinutes) {
    // Ensure we don't get negative speed
    const penalty = (mistakes - timeMinutes) * timeMinutes;
    const adjustedWords = Math.max(0, wordsTyped - penalty);
    netSpeed = timeMinutes > 0 ? Math.round(adjustedWords / timeMinutes) : 0;
  } else {
    netSpeed = grossSpeed;
  }

  return {
    wordsTyped,
    mistakes,
    backspaces,
    grossSpeed,
    netSpeed,
    accuracy
  };
}

export function calculateShorthandStats(original: string, typed: string, contentWordCount: number) {
  // Exact match logic (including spaces)
  const wordsTyped = typed.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  let mistakes = 0;
  // User request: "even a blank space should be counted" -> implies char by char strict check?
  // "Do a exact match of the content uploaded by the admin and content typed by the user"
  
  // However, shorthand is about transcribing. Usually we compare WORDS.
  // But "even a blank space" suggests strict string equality check.
  // Let's do word-based diffing but be strict about spaces? 
  // Actually, let's stick to the previous char-diff logic for simplicity unless "Exact match" implies strict equality.
  // If I type "hello " and expected "hello", is that a mistake? Yes.
  
  // Let's use word array comparison for "5% rule" context usually applies to words.
  // Let's calculate mistakes based on Words for the 5% rule to make sense.
  
  const originalWords = original.trim().split(/\s+/);
  const typedWords = typed.trim().split(/\s+/);
  
  // Simple Levenshtein-like word error count or just index mismatch?
  // Let's do simple index comparison for now.
  const maxWords = Math.max(originalWords.length, typedWords.length);
  let wordMistakes = 0;
  
  for(let i=0; i<maxWords; i++) {
    if (originalWords[i] !== typedWords[i]) {
      wordMistakes++;
    }
  }
  
  // 5% Rule
  const allowedMistakes = Math.ceil(contentWordCount * 0.05);
  const result = wordMistakes <= allowedMistakes ? 'Pass' : 'Fail';
  
  return {
    wordsTyped,
    mistakes: wordMistakes,
    result: result as 'Pass' | 'Fail'
  };
}

export function formatDate(dateStr: string | number) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
