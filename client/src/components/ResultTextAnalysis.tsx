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
        
        // Case-insensitive comparison: 
        // If words match case-insensitively, it's NOT an error (even if case differs).
        // If they differ case-insensitively (including punctuation differences), it IS an error.
        const isError = original.toLowerCase() !== typed.toLowerCase();

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
