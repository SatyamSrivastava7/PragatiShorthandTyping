/**
 * Server-authoritative High Court scoring engine.
 *
 * Max marks:  typing = 100,  pitman = 100,  shorthand = 200
 * Deductions: typing  – 0.2 per full error (no half)
 *             pitman  – 0.4 per full error (no half)
 *             shorthand – 0.4 per full error, 0.2 per half error
 *
 * Shorthand half-error rule:
 *   – paragraph/punctuation-only differences → half error
 *   – word omission / spelling / extra word   → full error
 *
 * Returns marks (floored at 0), fullMistakes, halfMistakes, and an
 * alignmentData array (serialised as JSON string) for client review.
 */

export type AlignmentEntry = {
  index: number;
  original: string;
  typed: string;
  errorType: "full" | "half" | "ok";
  reason?: string;
};

export type ScoringResult = {
  marks: number;
  fullMistakes: number;
  halfMistakes: number;
  alignmentData: string; // JSON
};

// Punctuation-only characters (English)
const PUNCTUATION_RE = /^[.,;:!?'"()\-–—\[\]{}\/\\@#$%^&*+=<>`~|]+$/;

/** Normalise a word token for comparison (lowercase, trim) */
function normalise(w: string): string {
  return w.toLowerCase().trim();
}

/** True when the only difference between original and typed is punctuation */
function isPunctuationDifference(orig: string, typed: string): boolean {
  const origNorm = orig.replace(/[.,;:!?'"()\-–—\[\]{}\/\\@#$%^&*+=<>`~|]/g, "").trim();
  const typedNorm = typed.replace(/[.,;:!?'"()\-–—\[\]{}\/\\@#$%^&*+=<>`~|]/g, "").trim();
  return normalise(origNorm) === normalise(typedNorm) && orig !== typed;
}

/** Paragraph-boundary token used only by this isolated scorer. */
const PARA_TOKEN = "[[PARA]]";

function textWithParagraphs(value: string): string {
  return value
    .replace(/\r\n|\r/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, ` ${PARA_TOKEN} `)
    .replace(/<\s*\/?\s*(p|div)[^>]*>/gi, ` ${PARA_TOKEN} `)
    .replace(/\n+/g, ` ${PARA_TOKEN} `)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function tokenise(text: string, preserveParagraphs: boolean): string[] {
  return textWithParagraphs(text)
    .split(/\s+/)
    .filter((word) => word.length > 0 && (preserveParagraphs || word !== PARA_TOKEN));
}

function matchingToken(type: "typing" | "pitman" | "shorthand", original: string, typed: string): boolean {
  if (normalise(original) === normalise(typed)) return true;
  return type === "shorthand" && original !== PARA_TOKEN && typed !== PARA_TOKEN &&
    normalise(original.replace(/[.,;:!?'"()\-–—\[\]{}\/\\@#$%^&*+=<>`~|]/g, "")) ===
    normalise(typed.replace(/[.,;:!?'"()\-–—\[\]{}\/\\@#$%^&*+=<>`~|]/g, ""));
}

/**
 * Longest-Common-Subsequence alignment of two token arrays.
 * Returns aligned pairs: [origToken | null, typedToken | null]
 */
function lcsAlign(type: "typing" | "pitman" | "shorthand", orig: string[], typed: string[]): Array<[string | null, string | null]> {
  const m = orig.length;
  const n = typed.length;
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (matchingToken(type, orig[i - 1], typed[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  // Backtrack
  const aligned: Array<[string | null, string | null]> = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && matchingToken(type, orig[i - 1], typed[j - 1])) {
      aligned.push([orig[i - 1], typed[j - 1]]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      aligned.push([null, typed[j - 1]]); // extra word in typed
      j--;
    } else {
      aligned.push([orig[i - 1], null]); // omitted word
      i--;
    }
  }
  return aligned.reverse();
}

function styleMismatches(originalHtml: string, typedHtml: string): number {
  const segments = (value: string, tag: "b" | "strong" | "i" | "em") => {
    const expression = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    return Array.from(value.matchAll(expression), (match) =>
      textWithParagraphs(match[1]).replace(new RegExp(PARA_TOKEN, "g"), " ").replace(/\s+/g, " ").trim().toLowerCase()
    ).filter(Boolean);
  };
  let mismatches = 0;
  for (const tag of ["b", "strong", "i", "em"] as const) {
    const expected = segments(originalHtml, tag);
    const actual = segments(typedHtml, tag);
    for (const expectedSegment of expected) {
      const index = actual.indexOf(expectedSegment);
      if (index >= 0) actual.splice(index, 1);
      else mismatches++;
    }
    mismatches += actual.length;
  }
  return mismatches;
}

/**
 * Core scoring function called by routes. Accepts plain-text (no HTML).
 */
export function scoreHighCourtTest(
  type: "typing" | "pitman" | "shorthand",
  originalText: string,
  typedText: string
): ScoringResult {
  const maxMarks = type === "shorthand" ? 200 : 100;
  const origTokens = tokenise(originalText, type === "shorthand");
  const typedTokens = tokenise(typedText, type === "shorthand");

  const aligned = lcsAlign(type, origTokens, typedTokens);

  let fullMistakes = 0;
  let halfMistakes = 0;
  const entries: AlignmentEntry[] = [];

  aligned.forEach(([orig, typed], idx) => {
    if (orig === null && typed !== null) {
      if (type === "shorthand" && typed === PARA_TOKEN) {
        halfMistakes++;
        entries.push({ index: idx, original: "", typed: "¶", errorType: "half", reason: "paragraph difference" });
      } else {
        fullMistakes++;
        entries.push({ index: idx, original: "", typed: typed!, errorType: "full", reason: "extra word" });
      }
    } else if (typed === null && orig !== null) {
      if (type === "shorthand" && orig === PARA_TOKEN) {
        halfMistakes++;
        entries.push({ index: idx, original: "¶", typed: "", errorType: "half", reason: "paragraph difference" });
      } else {
        fullMistakes++;
        entries.push({ index: idx, original: orig!, typed: "", errorType: "full", reason: "omission" });
      }
    } else if (orig !== null && typed !== null) {
      if (normalise(orig) === normalise(typed)) {
        // Exact match (case-insensitive) – OK
        entries.push({ index: idx, original: orig, typed: typed, errorType: "ok" });
      } else {
        // Mismatch
        if (type === "shorthand") {
          if (isPunctuationDifference(orig, typed)) {
            halfMistakes++;
            entries.push({ index: idx, original: orig, typed: typed, errorType: "half", reason: "punctuation difference" });
          } else if (PUNCTUATION_RE.test(orig) || PUNCTUATION_RE.test(typed)) {
            // Pure punctuation token difference → half
            halfMistakes++;
            entries.push({ index: idx, original: orig, typed: typed, errorType: "half", reason: "punctuation token" });
          } else {
            fullMistakes++;
            entries.push({ index: idx, original: orig, typed: typed, errorType: "full", reason: "spelling/word error" });
          }
        } else {
          // typing / pitman – full only
          fullMistakes++;
          entries.push({ index: idx, original: orig, typed: typed, errorType: "full", reason: "spelling/word error" });
        }
      }
    }
  });

  if (type === "typing") {
    const formattingErrors = styleMismatches(originalText, typedText);
    if (formattingErrors) {
      fullMistakes += formattingErrors;
      entries.push({
        index: entries.length,
        original: "formatting",
        typed: "formatting",
        errorType: "full",
        reason: "bold/italic formatting difference",
      });
    }
  }

  // Calculate deduction
  let deduction = 0;
  if (type === "typing") {
    deduction = fullMistakes * 0.2;
  } else if (type === "pitman") {
    deduction = fullMistakes * 0.4;
  } else {
    // shorthand
    deduction = fullMistakes * 0.4 + halfMistakes * 0.2;
  }

  const marks = Math.max(0, maxMarks - deduction);

  return {
    marks,
    fullMistakes,
    halfMistakes,
    alignmentData: JSON.stringify(entries),
  };
}
