import { cn, alignWords } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
}

export function ResultTextAnalysis({ originalText, typedText, language }: ResultTextAnalysisProps) {
  // Use LCS-based alignment that shows missing words in correct positions
  const alignment = alignWords(originalText, typedText);

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {alignment.map((item, i) => {
        // Missing word - show in green brackets
        if (item.status === 'missing') {
          return (
            <span key={i} className="text-green-600 font-medium">[{item.original}]</span>
          );
        }
        
        // Substitution - show typed word underlined in red + correct word in green brackets
        if (item.status === 'substitution') {
          return (
            <span key={i}>
              <span className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
                {item.typed}
              </span>
              <span className="text-green-600 font-medium">[{item.original}]</span>
            </span>
          );
        }
        
        // Extra word (typed but not in original) - show in orange with [Extra] label
        if (item.status === 'extra') {
          return (
            <span key={i} className="text-orange-600 dark:text-orange-400">
              {item.typed} <span className="text-xs font-medium">[Extra]</span>
            </span>
          );
        }
        
        // Match - show normally
        return <span key={i}>{item.typed}</span>;
      })}
    </div>
  );
}
