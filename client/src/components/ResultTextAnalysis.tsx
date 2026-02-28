import { cn, alignWords, getTypingAlignment, calculateAlignedMistakes, stripHtmlPreserveParagraphs, PARA_TOKEN, stripHtmlEntities } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  language?: 'english' | 'hindi';
  contentType?: 'typing' | 'shorthand';
}

export function ResultTextAnalysis({ originalText, typedText, language, contentType = 'typing' }: ResultTextAnalysisProps) {
  // Strip HTML tags from originalText for alignment calculations (preserve paragraph markers)
  const plainOriginalText = stripHtmlPreserveParagraphs(originalText);
  
  // Use appropriate alignment based on content type
  // For typing tests: use windowed alignment that limits search scope
  // For shorthand tests: use full DP alignment
  let alignment;
  if (contentType === 'typing') {
    alignment = getTypingAlignment(plainOriginalText, typedText);
  } else {
    const { attemptedAlignment, alignment: fullAlignment } = calculateAlignedMistakes(plainOriginalText, typedText);

    // Include trailing (left) words after the attempted alignment so shorthand analysis
    // shows both the attempted portion and the left words that were not attempted.
    const trailingItems = fullAlignment.filter((item) => {
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });

    alignment = [...attemptedAlignment, ...trailingItems];
  }

  return (
    <div className={cn("text-sm leading-relaxed flex flex-wrap gap-x-1", language === 'hindi' ? "font-mangal" : "")}>
      {alignment.map((item, i) => {
        // Paragraph token - render as a paragraph break
        if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
          return <div key={i} className="w-full my-2" />;
        }
        // Show trailing words (not attempted by user) in gray
        if (item.status === 'trailing') {
          return (
            <span key={i} className="text-muted-foreground/50">{stripHtmlEntities(item.original)}</span>
          );
        }
        
        // Missing word - show in green brackets
        if (item.status === 'missing') {
          return (
            <span key={i} className="text-green-600 font-medium">[{stripHtmlEntities(item.original)}]</span>
          );
        }
        
        // Substitution - show typed (errored) word FIRST, then correct word in green brackets
        if (item.status === 'substitution') {
          return (
            <span key={i}>
              <span className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2 mr-1">
                {stripHtmlEntities(item.typed)}
              </span>
              <span className="text-green-600 font-medium">[{stripHtmlEntities(item.original)}]</span>
            </span>
          );
        }
        
        // Extra word (typed but not in original) - show underlined in red
        if (item.status === 'extra') {
          return (
            <span key={i} className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2">
              {stripHtmlEntities(item.typed)}
            </span>
          );
        }
        
        // Match - show normally
        return <span key={i}>{stripHtmlEntities(item.typed)}</span>;
      })}
    </div>
  );
}

// Helper function to normalize words for comparison
function normalizeWord(word: string): string {
  return word.replace(/[.,]/g, "").toLowerCase();
}
