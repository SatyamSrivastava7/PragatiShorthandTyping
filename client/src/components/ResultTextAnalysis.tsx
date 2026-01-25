import { cn, alignWords } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
}

export function ResultTextAnalysis({ originalText, typedText, language }: ResultTextAnalysisProps) {
  // Use LCS-based alignment that shows missing words in correct positions
  const alignment = alignWords(originalText, typedText);

  // Track words we've recently shown in brackets to prevent duplication
  const shownBracketedWords: Set<string> = new Set();

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {alignment.map((item, i) => {
        // Check if next item is a match of the current missing word - if so, skip this missing entry
        if (item.status === 'missing') {
          const normalizedCurrent = normalizeWord(item.original);
          
          // Check if we just showed this word in brackets recently (last 2 items)
          let isDuplicate = false;
          for (let j = Math.max(0, i - 2); j < i; j++) {
            const prevItem = alignment[j];
            if (prevItem.status === 'missing' && normalizeWord(prevItem.original) === normalizedCurrent) {
              isDuplicate = true;
              break;
            }
            if ((prevItem.status === 'substitution' || prevItem.status === 'match') && 
                normalizeWord(prevItem.original) === normalizedCurrent) {
              isDuplicate = true;
              break;
            }
          }
          
          if (isDuplicate) {
            return null; // Skip duplicate bracketed word
          }
          
          shownBracketedWords.add(normalizedCurrent);
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
