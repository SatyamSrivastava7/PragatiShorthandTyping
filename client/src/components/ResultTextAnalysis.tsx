import { cn, getTypingAlignment, calculateAlignedMistakes, PARA_TOKEN, stripHtmlEntities, stripHtml, type AlignmentEntry } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  originalTextClean?: string; // Optional: if provided, use instead of stripping
  typedTextClean?: string; // Optional: if provided, use instead of stripping
  language?: 'english' | 'hindi';
  contentType?: 'typing' | 'shorthand' | 'allahabad-hc';
}

export function ResultTextAnalysis({ originalText, typedText, originalTextClean, typedTextClean, language, contentType = 'typing' }: ResultTextAnalysisProps) {
  // For Allahabad-HC tests: show the full formatted typed text with HTML preserved (like original text)
  // For other tests: use alignment-based analysis
  if (contentType === 'typing' && typedText && typedText.includes('<')) {
    // This is Allahabad-HC test (RichTextEditor with HTML formatting)
    // Display the typed text with full HTML formatting preserved
    return (
      <div
        className={cn(
          "text-sm",
          "leading-relaxed",
          language === 'hindi' ? "font-mangal" : "font-times",
          "text-justify"
        )}
        dangerouslySetInnerHTML={{ __html: typedText }}
      />
    );
  }
  
  // For alignment calculation: strip HTML but keep PARA_TOKEN to properly align at word level
  // Display will show original text with HTML formatting (bold, italic, underline, etc.) preserved
  const alignmentOriginalText = stripHtml(originalText);
  const alignmentTypedText = stripHtml(typedText);
  
  // Use appropriate alignment based on content type with same logic as PDF generation
  // For typing tests: use windowed alignment that limits search scope
  // For shorthand tests: use full DP alignment and calculate mistakes same way as PDF
  let alignment;
  let calculatedMistakes = 0;
  let calculatedTrailingWords = 0;
  
  if (contentType === 'typing') {
    alignment = getTypingAlignment(alignmentOriginalText, alignmentTypedText);
    // For typing: count mistakes from alignment
    calculatedMistakes = alignment.filter(a => a.status !== 'match' && a.status !== 'trailing').length;
  } else {
    // For shorthand: use same calculation as PDF generation
    const { mistakes: recalcMistakes, attemptedAlignment, alignment: fullAlignment, trailingWords: recalcTrailing } = calculateAlignedMistakes(alignmentOriginalText, alignmentTypedText);
    
    // Include trailing (left) words after the attempted alignment so shorthand analysis
    // shows both the attempted portion and the left words that were not attempted.
    const trailingItems = fullAlignment.filter((item) => {
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });

    alignment = [...attemptedAlignment, ...trailingItems];
    
    // Calculate total mistakes same way as PDF: mistakes + trailing words
    calculatedMistakes = recalcMistakes + recalcTrailing;
    calculatedTrailingWords = recalcTrailing;
  }

  // helper class to add spacing between words
  const wordWrapperClass = "inline-block mr-1";

  const lineHeightClass = "leading-relaxed";

  // Normalize excessive consecutive paragraph tokens (3+) while preserving intentional spacing (1-2)
  const normalizedAlignment = alignment.reduce((acc: AlignmentEntry[], item) => {
    const isParaToken = item.original === PARA_TOKEN || item.typed === PARA_TOKEN;
    
    if (!isParaToken) {
      acc.push(item);
      return acc;
    }
    
    // Count consecutive paragraph tokens at the end
    let consecutiveCount = 0;
    for (let j = acc.length - 1; j >= 0; j--) {
      const prevItem = acc[j];
      if (prevItem.original === PARA_TOKEN || prevItem.typed === PARA_TOKEN) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    // Allow up to 2 consecutive paragraph tokens, collapse 3+
    if (consecutiveCount < 2) {
      acc.push(item);
    }
    // If we already have 2+ consecutive, skip additional ones
    
    return acc;
  }, []);

  return (
    <div
      className={cn(
        "text-sm",
        lineHeightClass,
        language === 'hindi' ? "font-mangal" : "font-times",
        "text-justify"
      )}
    >
      {normalizedAlignment.map((item, i) => {
        // Paragraph token - render as a paragraph break
        if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
          return <div key={i} className="w-full my-2" />;
        }
        // Show trailing words (not attempted by user) in gray
        if (item.status === 'trailing') {
          return (
            <span key={i} className={cn(wordWrapperClass, "text-muted-foreground/50")} dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }} />
          );
        }
        
        // Missing word - show in green brackets
        if (item.status === 'missing') {
          return (
            <span key={i} className={cn(wordWrapperClass, "text-green-600 font-medium")}>[<span dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }} />]</span>
          );
        }
        
        // Substitution - show typed (errored) word FIRST, then correct word in green brackets
        if (item.status === 'substitution') {
          return (
            <span key={i} className={wordWrapperClass}>
              <span className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2 mr-1" dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.typed) }} />
              <span className="text-green-600 font-medium">[<span dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }} />]</span>
            </span>
          );
        }
        
        // Extra word (typed but not in original) - show underlined in red
        if (item.status === 'extra') {
          return (
            <span key={i} className={cn(wordWrapperClass, "text-red-600 decoration-red-600 decoration-2 underline underline-offset-2")} dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.typed) }} />
          );
        }
        
        // Match - show normally, with HTML formatting preserved
        if (item.typed === PARA_TOKEN || item.original === PARA_TOKEN) {
          return <div key={i} className="w-full my-2" />;
        }
        return <span key={i} className={wordWrapperClass} dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.typed) }} />;
      })}
    </div>
  );
}

// Helper function to normalize words for comparison
function normalizeWord(word: string): string {
  return word.replace(/[.,]/g, "").toLowerCase();
}
