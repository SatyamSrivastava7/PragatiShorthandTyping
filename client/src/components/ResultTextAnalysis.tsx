import { cn, alignWords } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
}

export function ResultTextAnalysis({ originalText, typedText, language }: ResultTextAnalysisProps) {
  // Use aligned word comparison to handle word splits/joins
  const alignment = alignWords(originalText, typedText);

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {alignment.map((item, i) => {
        if (item.isError) {
          return (
             <span key={i} className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
               {item.typed}
             </span>
          );
        }
        
        return <span key={i}>{item.typed}</span>;
      })}
    </div>
  );
}
