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

export function calculateAccuracy(original: string, typed: string): { accuracy: number, mismatches: number } {
  let correctChars = 0;
  let mismatches = 0;
  const minLen = Math.min(original.length, typed.length);

  for (let i = 0; i < minLen; i++) {
    if (original[i] === typed[i]) {
      correctChars++;
    } else {
      mismatches++;
    }
  }
  
  // Count extra characters as mismatches if typed is longer
  if (typed.length > original.length) {
    mismatches += typed.length - original.length;
  }
  
  const accuracy = typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100;
  
  return { accuracy, mismatches };
}

export function formatDate(dateStr: string | number) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
