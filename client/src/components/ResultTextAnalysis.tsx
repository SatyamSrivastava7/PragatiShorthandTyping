import { cn, alignWords } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
}

export function ResultTextAnalysis({ originalText, typedText, language }: ResultTextAnalysisProps) {
  // Use aligned word comparison to handle word splits/joins
  const alignment = alignWords(originalText, typedText);
  
  // Get original words for showing missing words at the end
  const originalWords = (originalText || "").trim().split(/\s+/).filter(w => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter(w => w);
  const missingWordsCount = Math.max(0, originalWords.length - typedWords.length);
  const missingWords = missingWordsCount > 0 ? originalWords.slice(-missingWordsCount) : [];

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {alignment.map((item, i) => {
        if (item.isError) {
          return (
            <span key={i}>
              <span className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
                {item.typed}
              </span>
              {item.original && (
                <span className="text-green-600 font-medium">[{item.original}]</span>
              )}
            </span>
          );
        }
        
        return <span key={i}>{item.typed}</span>;
      })}
      {missingWords.map((word, i) => (
        <span key={`missing-${i}`} className="text-green-600 font-medium">[{word}]</span>
      ))}
    </div>
  );
}
