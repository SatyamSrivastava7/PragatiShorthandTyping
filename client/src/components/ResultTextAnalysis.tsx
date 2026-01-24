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
        // Check if next item is a match of the current missing word - if so, skip this missing entry
        if (item.status === 'missing') {
          const nextItem = alignment[i + 1];
          if (nextItem && nextItem.status === 'match' && normalizeWord(nextItem.original) === normalizeWord(item.original)) {
            return null; // Skip showing this missing entry since the next entry is the same word matched
          }
          return (
            <span key={i} className="text-green-600 font-medium">[{item.original}]</span>
          );
        }
        
        // Substitution - show correct word in green brackets FIRST, then typed word underlined in red
        if (item.status === 'substitution') {
          return (
            <span key={i}>
              <span className="text-green-600 font-medium">[{item.original}]</span>
              <span className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
                {item.typed}
              </span>
            </span>
          );
        }
        
        // Extra word (typed but not in original) - show underlined in red
        if (item.status === 'extra') {
          return (
            <span key={i} className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
              {item.typed}
            </span>
          );
        }
        
        // Match - show normally
        return <span key={i}>{item.typed}</span>;
      })}
    </div>
  );
}

// Helper function to normalize words for comparison
function normalizeWord(word: string): string {
  return word.replace(/[.,]/g, "").toLowerCase();
}
