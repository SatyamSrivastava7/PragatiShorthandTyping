import { cn, getTypingAlignment, calculateAlignedMistakes, PARA_TOKEN, stripHtmlEntities, stripHtml, type AlignmentEntry } from "@/lib/utils";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  originalTextClean?: string;
  typedTextClean?: string;
  language?: 'english' | 'hindi';
  contentType?: 'typing' | 'shorthand' | 'allahabad-hc';
}

/**
 * Extracts words from allahabad-hc typed text (which contains inline HTML + [[PARA]] tokens),
 * returning each word paired with its HTML-wrapped version so formatting is preserved.
 *
 * Input example:  "<strong>Heading word</strong> [[PARA]] <em>italic</em> plain"
 * Output example: [
 *   { plain: "Heading", html: "<strong>Heading</strong>" },
 *   { plain: "word",    html: "<strong>word</strong>" },
 *   { plain: "italic",  html: "<em>italic</em>" },
 *   { plain: "plain",   html: "plain" },
 * ]
 */
function extractTypedWordsWithFormatting(typedText: string): Array<{ plain: string; html: string }> {
  const result: Array<{ plain: string; html: string }> = [];
  if (!typedText) return result;

  const withoutPara = typedText.replace(/\[\[PARA\]\]/g, " ");
  const inlineTagNames = new Set(["strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "span"]);
  const activeTags: string[] = [];

  const tokenRegex = /(<[^>]+>)|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(withoutPara)) !== null) {
    const token = match[0];

    if (token.startsWith("<")) {
      if (token.startsWith("</")) {
        const tagName = token.match(/<\/(\w+)/)?.[1]?.toLowerCase();
        if (tagName && inlineTagNames.has(tagName)) {
          const idx = activeTags.lastIndexOf(tagName);
          if (idx !== -1) activeTags.splice(idx, 1);
        }
      } else if (!token.endsWith("/>")) {
        const tagName = token.match(/<(\w+)/)?.[1]?.toLowerCase();
        if (tagName && inlineTagNames.has(tagName)) {
          activeTags.push(tagName);
        }
      }
    } else {
      const plain = stripHtmlEntities(token);
      let html = token;
      if (activeTags.length > 0) {
        const open = activeTags.map((t) => `<${t}>`).join("");
        const close = [...activeTags].reverse().map((t) => `</${t}>`).join("");
        html = open + token + close;
      }
      result.push({ plain, html });
    }
  }

  return result;
}

export function ResultTextAnalysis({
  originalText,
  typedText,
  originalTextClean,
  typedTextClean,
  language,
  contentType = "typing",
}: ResultTextAnalysisProps) {
  const isAllahabadHC = contentType === "allahabad-hc";

  // For Allahabad-HC: build a sequential word list with HTML formatting from raw typedText.
  // This lets us restore bold/italic/underline on each word when rendering the comparison.
  const typedWordSeq: Array<{ plain: string; html: string }> = isAllahabadHC
    ? extractTypedWordsWithFormatting(typedText)
    : [];

  // Choose plain text for alignment.
  // Allahabad-HC uses the stored clean versions (no HTML, no PARA tokens).
  // We also strip any leftover [[PARA]] / [[PAR] artifacts from older stored data.
  const cleanParaPattern = /\[\[PARA?\]?\]?/g;

  const alignmentOriginalText = isAllahabadHC
    ? (originalTextClean || stripHtml(originalText)).replace(cleanParaPattern, "").replace(/\s+/g, " ").trim()
    : stripHtml(originalText);

  const alignmentTypedText = isAllahabadHC
    ? (typedTextClean || stripHtml(typedText)).replace(cleanParaPattern, "").replace(/\s+/g, " ").trim()
    : stripHtml(typedText);

  // Compute word-level alignment
  let alignment: AlignmentEntry[];
  let calculatedMistakes = 0;
  let calculatedTrailingWords = 0;

  if (contentType === "typing" || isAllahabadHC) {
    alignment = getTypingAlignment(alignmentOriginalText, alignmentTypedText);
    calculatedMistakes = alignment.filter(
      (a) => a.status !== "match" && a.status !== "trailing"
    ).length;
  } else {
    const {
      mistakes: recalcMistakes,
      attemptedAlignment,
      alignment: fullAlignment,
      trailingWords: recalcTrailing,
    } = calculateAlignedMistakes(alignmentOriginalText, alignmentTypedText);

    const trailingItems = fullAlignment.filter((item) => {
      const isInAttempted = attemptedAlignment.some(
        (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
      );
      return !isInAttempted && item.original !== "";
    });

    alignment = [...attemptedAlignment, ...trailingItems];
    calculatedMistakes = recalcMistakes + recalcTrailing;
    calculatedTrailingWords = recalcTrailing;
  }

  // Normalize excessive consecutive paragraph tokens (collapse 3+ → max 2)
  const normalizedAlignment = alignment.reduce((acc: AlignmentEntry[], item) => {
    const isParaToken = item.original === PARA_TOKEN || item.typed === PARA_TOKEN;
    if (!isParaToken) {
      acc.push(item);
      return acc;
    }
    let consecutiveCount = 0;
    for (let j = acc.length - 1; j >= 0; j--) {
      const prev = acc[j];
      if (prev.original === PARA_TOKEN || prev.typed === PARA_TOKEN) consecutiveCount++;
      else break;
    }
    if (consecutiveCount < 2) acc.push(item);
    return acc;
  }, []);

  // Pre-map each alignment entry's typed word to its HTML-formatted version.
  // We consume typedWordSeq sequentially because alignment preserves typed-word order.
  let seqIdx = 0;
  type EnrichedEntry = AlignmentEntry & { typedHtml?: string };
  const enrichedAlignment: EnrichedEntry[] = normalizedAlignment.map((item) => {
    if (!isAllahabadHC || !item.typed || item.typed === PARA_TOKEN || typedWordSeq.length === 0) {
      return { ...item };
    }

    const target = item.typed.toLowerCase();
    let typedHtml: string | undefined;

    while (seqIdx < typedWordSeq.length) {
      const seqWord = typedWordSeq[seqIdx++];
      if (seqWord.plain.toLowerCase() === target) {
        typedHtml = seqWord.html;
        break;
      }
    }

    return { ...item, typedHtml };
  });

  const wordWrapperClass = "inline-block mr-1";
  const lineHeightClass = "leading-relaxed";

  return (
    <div
      className={cn(
        "text-sm",
        lineHeightClass,
        language === "hindi" ? "font-mangal" : "font-times",
        "text-justify"
      )}
    >
      {enrichedAlignment.map((item, i) => {
        // Paragraph break
        if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
          return <div key={i} className="w-full my-2" />;
        }

        // Trailing — not attempted by student, shown dimmed
        if (item.status === "trailing") {
          return (
            <span
              key={i}
              className={cn(wordWrapperClass, "text-muted-foreground/50")}
              dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }}
            />
          );
        }

        // Missing — word not typed at all, shown in green brackets
        if (item.status === "missing") {
          return (
            <span key={i} className={cn(wordWrapperClass, "text-green-600 font-medium")}>
              [<span dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }} />]
            </span>
          );
        }

        // Substitution — wrong word typed.
        // For Allahabad-HC: preserve student's formatting on the typed (wrong) word.
        if (item.status === "substitution") {
          const typedHtml = item.typedHtml || stripHtmlEntities(item.typed);
          return (
            <span key={i} className={wordWrapperClass}>
              <span
                className="text-red-600 decoration-red-600 decoration-2 underline underline-offset-2 mr-1"
                dangerouslySetInnerHTML={{ __html: typedHtml }}
              />
              <span className="text-green-600 font-medium">
                [<span dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.original) }} />]
              </span>
            </span>
          );
        }

        // Extra — typed but not in original, shown underlined red.
        // For Allahabad-HC: preserve student's formatting.
        if (item.status === "extra") {
          const typedHtml = item.typedHtml || stripHtmlEntities(item.typed);
          return (
            <span
              key={i}
              className={cn(
                wordWrapperClass,
                "text-red-600 decoration-red-600 decoration-2 underline underline-offset-2"
              )}
              dangerouslySetInnerHTML={{ __html: typedHtml }}
            />
          );
        }

        // Match — correct word.
        // For Allahabad-HC: render with student's HTML formatting (bold/italic/underline).
        // For other tests: render plain text.
        const matchHtml = isAllahabadHC
          ? (item.typedHtml || stripHtmlEntities(item.typed))
          : stripHtmlEntities(item.typed);

        return (
          <span
            key={i}
            className={wordWrapperClass}
            dangerouslySetInnerHTML={{ __html: matchHtml }}
          />
        );
      })}
    </div>
  );
}
