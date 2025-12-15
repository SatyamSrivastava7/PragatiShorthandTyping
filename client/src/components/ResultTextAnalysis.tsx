import React from 'react';
import { cn } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
}

export function ResultTextAnalysis({ originalText, typedText, language }: ResultTextAnalysisProps) {
  const originalWords = (originalText || "").trim().split(/\s+/);
  const typedWords = typedText.trim().split(/\s+/);
  const maxLength = Math.max(originalWords.length, typedWords.length);

  const fontClass = language === 'hindi' ? "font-family: 'Mangal', sans-serif;" : "";

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {Array.from({ length: maxLength }).map((_, i) => {
        const original = originalWords[i] || "";
        const typed = typedWords[i] || "";
        
        let isError = false;
        
        // Simple mismatch check
        if (original !== typed) {
            // Check case-insensitive
            if (original.toLowerCase() !== typed.toLowerCase()) {
                isError = true;
            } else {
                 // Case matches, exact match failed? Must be punctuation or case sensitivity if we care (we do for Hindi/English usually)
                 // But PDF logic uses case-insensitive for words but penalizes punctuation.
                 // Let's stick to simple: If it's not exact match, check if it counts as error.
                 
                 // Reuse PDF logic roughly:
                 const cleanOriginal = original.replace(/[.,]/g, '');
                 const cleanTyped = typed.replace(/[.,]/g, '');
                 
                 if (cleanOriginal.toLowerCase() !== cleanTyped.toLowerCase()) {
                     isError = true;
                 }
                 // If word matches but punctuation mismatch -> strictly it's an error in typing tests usually.
                 // If original != typed, let's underline it to be safe and strict.
                 isError = true; 
            }
        }
        
        // Refined Logic based on PDF:
        // if (original.toLowerCase() !== typed.toLowerCase()) -> Error
        // if original == typed (case insensitive) -> Check if punctuation differs. If so, Error.
        
        if (original.toLowerCase() !== typed.toLowerCase()) {
             isError = true;
        } else {
            // Word content matches.
            // If exact string doesn't match (case or punctuation), mark error?
            // The user asked to underline errors.
            if (original !== typed) {
                // This catches punctuation diffs and case diffs
                isError = true;
            }
        }

        if (isError) {
          return (
             <span key={i} className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
               {typed}
             </span>
          );
        }
        
        return <span key={i}>{typed}</span>;
      })}
    </div>
  );
}
