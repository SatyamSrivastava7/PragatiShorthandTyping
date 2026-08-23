/**
 * High Court-only comparison and scoring engine.
 *
 * This module deliberately owns its own text normalization and alignment logic.
 * It mirrors the established student-facing comparison behaviour without
 * importing generic assessment utilities, so High Court scoring stays isolated.
 */

export type HighCourtPaper = "typing" | "pitman" | "shorthand";
export type ComparisonStatus = "match" | "substitution" | "missing" | "extra";

export type AlignmentEntry = {
  index: number;
  original: string;
  typed: string;
  status: ComparisonStatus;
  errorType: "full" | "half" | "ok";
  reason?: string;
};

export type ScoringResult = {
  marks: number;
  fullMistakes: number;
  halfMistakes: number;
  alignmentData: string;
};

type RawAlignment = Pick<AlignmentEntry, "original" | "typed" | "status">;

const PARAGRAPH_TOKEN = "[[HIGH_COURT_PARAGRAPH]]";
const PUNCTUATION = /[.,;:!?"'“”‘’()\-–—\[\]{}\/\\@#$%^&*+=<>`~|…]/g;
const MAX_ALIGNMENT_CELLS = 2_000_000;
const LONG_TEXT_WINDOW = 280;

function normalizeComparisonToken(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\.\.\./g, "…")
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'")
    .trim()
    .toLowerCase();
}

function decodeText(value: string): string {
  return value
    .replace(/\r\n|\r/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, ` ${PARAGRAPH_TOKEN} `)
    .replace(/<\s*\/?\s*(p|div)[^>]*>/gi, ` ${PARAGRAPH_TOKEN} `)
    .replace(/\n+/g, ` ${PARAGRAPH_TOKEN} `)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function tokenize(value: string, keepParagraphs: boolean): string[] {
  return decodeText(value)
    .split(/\s+/)
    .filter((token) => token && (keepParagraphs || token !== PARAGRAPH_TOKEN));
}

function isExactMatch(original: string, typed: string): boolean {
  return normalizeComparisonToken(original) === normalizeComparisonToken(typed);
}

function wordWithoutPunctuation(value: string): string {
  return normalizeComparisonToken(value).replace(PUNCTUATION, "");
}

function isPunctuationOnlyDifference(original: string, typed: string): boolean {
  if (original === PARAGRAPH_TOKEN || typed === PARAGRAPH_TOKEN) return false;
  return wordWithoutPunctuation(original) === wordWithoutPunctuation(typed) &&
    normalizeComparisonToken(original) !== normalizeComparisonToken(typed);
}

/**
 * Find a minimum-edit alignment. Prefer a substitution over a missing-plus-extra
 * pair whenever both texts have a token at the current position, which keeps the
 * comparison view readable around repeated words and spelling errors.
 */
function alignShortPassage(original: string[], typed: string[]): RawAlignment[] {
  const originalLength = original.length;
  const typedLength = typed.length;
  const width = typedLength + 1;
  const costs = new Uint32Array((originalLength + 1) * width);
  const at = (originalIndex: number, typedIndex: number) => originalIndex * width + typedIndex;

  for (let originalIndex = 0; originalIndex <= originalLength; originalIndex++) {
    costs[at(originalIndex, 0)] = originalIndex;
  }
  for (let typedIndex = 0; typedIndex <= typedLength; typedIndex++) {
    costs[at(0, typedIndex)] = typedIndex;
  }

  for (let originalIndex = 1; originalIndex <= originalLength; originalIndex++) {
    for (let typedIndex = 1; typedIndex <= typedLength; typedIndex++) {
      if (isExactMatch(original[originalIndex - 1], typed[typedIndex - 1])) {
        costs[at(originalIndex, typedIndex)] = costs[at(originalIndex - 1, typedIndex - 1)];
        continue;
      }

      const substitute = costs[at(originalIndex - 1, typedIndex - 1)] + 1;
      const omit = costs[at(originalIndex - 1, typedIndex)] + 1;
      const extra = costs[at(originalIndex, typedIndex - 1)] + 1;
      costs[at(originalIndex, typedIndex)] = Math.min(substitute, omit, extra);
    }
  }

  const alignment: RawAlignment[] = [];
  let originalIndex = originalLength;
  let typedIndex = typedLength;

  while (originalIndex > 0 || typedIndex > 0) {
    const current = costs[at(originalIndex, typedIndex)];

    if (
      originalIndex > 0 &&
      typedIndex > 0 &&
      isExactMatch(original[originalIndex - 1], typed[typedIndex - 1]) &&
      current === costs[at(originalIndex - 1, typedIndex - 1)]
    ) {
      alignment.push({
        original: original[originalIndex - 1],
        typed: typed[typedIndex - 1],
        status: "match",
      });
      originalIndex--;
      typedIndex--;
      continue;
    }

    if (
      originalIndex > 0 &&
      typedIndex > 0 &&
      current === costs[at(originalIndex - 1, typedIndex - 1)] + 1
    ) {
      alignment.push({
        original: original[originalIndex - 1],
        typed: typed[typedIndex - 1],
        status: "substitution",
      });
      originalIndex--;
      typedIndex--;
      continue;
    }

    if (originalIndex > 0 && current === costs[at(originalIndex - 1, typedIndex)] + 1) {
      alignment.push({
        original: original[originalIndex - 1],
        typed: "",
        status: "missing",
      });
      originalIndex--;
      continue;
    }

    alignment.push({
      original: "",
      typed: typed[typedIndex - 1],
      status: "extra",
    });
    typedIndex--;
  }

  return alignment.reverse();
}

function uniqueAnchors(original: string[], typed: string[]) {
  const typedPositions = new Map<string, number[]>();
  typed.forEach((token, index) => {
    const normalized = normalizeComparisonToken(token);
    if (normalized && normalized !== PARAGRAPH_TOKEN) {
      typedPositions.set(normalized, [...(typedPositions.get(normalized) || []), index]);
    }
  });

  const originalCounts = new Map<string, number>();
  original.forEach((token) => {
    const normalized = normalizeComparisonToken(token);
    if (normalized && normalized !== PARAGRAPH_TOKEN) {
      originalCounts.set(normalized, (originalCounts.get(normalized) || 0) + 1);
    }
  });

  const anchors: Array<{ originalIndex: number; typedIndex: number }> = [];
  let lastTypedIndex = -1;
  original.forEach((token, originalIndex) => {
    const normalized = normalizeComparisonToken(token);
    const locations = typedPositions.get(normalized);
    if (originalCounts.get(normalized) !== 1 || locations?.length !== 1) return;
    if (locations[0] > lastTypedIndex) {
      anchors.push({ originalIndex, typedIndex: locations[0] });
      lastTypedIndex = locations[0];
    }
  });

  return anchors;
}

/**
 * A passage can be much larger than a normal answer. Unique matching words make
 * safe anchors, keeping each edit-distance calculation bounded. If a very
 * repetitive passage has no safe anchor, overlapping windows still use the same
 * substitution-first algorithm rather than falling back to an LCS matcher.
 */
function alignLongPassage(original: string[], typed: string[]): RawAlignment[] {
  const anchors = uniqueAnchors(original, typed);
  if (anchors.length) {
    const result: RawAlignment[] = [];
    let originalStart = 0;
    let typedStart = 0;

    for (const anchor of anchors) {
      result.push(
        ...alignPassage(
          original.slice(originalStart, anchor.originalIndex),
          typed.slice(typedStart, anchor.typedIndex),
        ),
      );
      result.push({
        original: original[anchor.originalIndex],
        typed: typed[anchor.typedIndex],
        status: "match",
      });
      originalStart = anchor.originalIndex + 1;
      typedStart = anchor.typedIndex + 1;
    }

    result.push(...alignPassage(original.slice(originalStart), typed.slice(typedStart)));
    return result;
  }

  const result: RawAlignment[] = [];
  let originalStart = 0;
  let typedStart = 0;

  while (originalStart < original.length || typedStart < typed.length) {
    const originalWindow = original.slice(originalStart, originalStart + LONG_TEXT_WINDOW);
    const typedWindow = typed.slice(typedStart, typedStart + LONG_TEXT_WINDOW);
    const window = alignShortPassage(originalWindow, typedWindow);

    if (
      originalStart + originalWindow.length >= original.length &&
      typedStart + typedWindow.length >= typed.length
    ) {
      result.push(...window);
      break;
    }

    let originalConsumed = 0;
    let typedConsumed = 0;
    let cutAt = -1;
    for (let index = 0; index < window.length; index++) {
      if (window[index].original) originalConsumed++;
      if (window[index].typed) typedConsumed++;
      if (
        window[index].status === "match" &&
        originalConsumed >= Math.floor(LONG_TEXT_WINDOW * 0.65) &&
        typedConsumed >= Math.floor(LONG_TEXT_WINDOW * 0.65)
      ) {
        cutAt = index;
      }
    }

    if (cutAt === -1) {
      result.push(...window);
      originalStart += originalWindow.length;
      typedStart += typedWindow.length;
      continue;
    }

    const completed = window.slice(0, cutAt + 1);
    result.push(...completed);
    originalStart += completed.filter((entry) => entry.original).length;
    typedStart += completed.filter((entry) => entry.typed).length;
  }

  return result;
}

function alignPassage(original: string[], typed: string[]): RawAlignment[] {
  if (!original.length) {
    return typed.map((token) => ({ original: "", typed: token, status: "extra" as const }));
  }
  if (!typed.length) {
    return original.map((token) => ({ original: token, typed: "", status: "missing" as const }));
  }
  if (original.length * typed.length <= MAX_ALIGNMENT_CELLS) {
    return alignShortPassage(original, typed);
  }
  return alignLongPassage(original, typed);
}

type FormatStyle = "bold" | "italic" | "underline";
type StyledToken = { value: string; styles: string };

function stylesFromOpeningTag(tagName: string, tag: string): FormatStyle[] {
  const styles: FormatStyle[] = [];
  if (tagName === "b" || tagName === "strong") styles.push("bold");
  if (tagName === "i" || tagName === "em") styles.push("italic");
  if (tagName === "u") styles.push("underline");
  if (tagName === "span") {
    const style = tag.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
    if (/\bfont-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(style)) styles.push("bold");
    if (/\bfont-style\s*:\s*(?:italic|oblique)\b/i.test(style)) styles.push("italic");
    if (/\btext-decoration(?:-line)?\s*:\s*[^;]*underline/i.test(style)) styles.push("underline");
  }
  return styles;
}

function formattedTokens(value: string): StyledToken[] {
  const frames: Array<{ tagName: string; styles: FormatStyle[] }> = [];
  const tokens: StyledToken[] = [];
  const tagsAndText = /<[^>]+>|[^<]+/g;

  for (const part of value.match(tagsAndText) || []) {
    const tagMatch = part.match(/^<\s*(\/?)\s*([a-z0-9]+)[^>]*>$/i);
    if (tagMatch) {
      const [, closing, rawTagName] = tagMatch;
      const tagName = rawTagName.toLowerCase();
      if (closing) {
        for (let index = frames.length - 1; index >= 0; index--) {
          if (frames[index].tagName === tagName) {
            frames.splice(index, 1);
            break;
          }
        }
      } else {
        frames.push({ tagName, styles: stylesFromOpeningTag(tagName, part) });
      }
      continue;
    }

    const activeStyles = Array.from(new Set(frames.flatMap((frame) => frame.styles))).sort().join(",");
    for (const token of decodeText(part).split(/\s+/)) {
      if (token && token !== PARAGRAPH_TOKEN) tokens.push({ value: token, styles: activeStyles });
    }
  }

  return tokens;
}

function styleMismatchCount(originalHtml: string, typedHtml: string): number {
  const expected = formattedTokens(originalHtml);
  const submitted = formattedTokens(typedHtml);
  const alignment = alignPassage(
    expected.map((token) => token.value),
    submitted.map((token) => token.value),
  );

  let expectedIndex = 0;
  let submittedIndex = 0;
  let previousDifference = "";
  let mismatchCount = 0;

  for (const entry of alignment) {
    const expectedToken = entry.original ? expected[expectedIndex++] : undefined;
    const submittedToken = entry.typed ? submitted[submittedIndex++] : undefined;
    if (entry.status !== "match" || !expectedToken || !submittedToken) {
      previousDifference = "";
      continue;
    }

    const difference = `${expectedToken.styles}|${submittedToken.styles}`;
    if (expectedToken.styles !== submittedToken.styles && difference !== previousDifference) {
      mismatchCount++;
    }
    previousDifference = expectedToken.styles === submittedToken.styles ? "" : difference;
  }

  return mismatchCount;
}

function classifyEntry(type: HighCourtPaper, entry: RawAlignment, index: number): AlignmentEntry {
  if (entry.status === "match") {
    return { ...entry, index, errorType: "ok" };
  }

  const displayOriginal = entry.original === PARAGRAPH_TOKEN ? "¶" : entry.original;
  const displayTyped = entry.typed === PARAGRAPH_TOKEN ? "¶" : entry.typed;
  const paragraphDifference = entry.original === PARAGRAPH_TOKEN || entry.typed === PARAGRAPH_TOKEN;
  const punctuationDifference = entry.status === "substitution" &&
    isPunctuationOnlyDifference(entry.original, entry.typed);
  const halfMistake = type === "shorthand" && (paragraphDifference || punctuationDifference);

  let reason: string;
  if (paragraphDifference) reason = "paragraph difference";
  else if (punctuationDifference) reason = "punctuation difference";
  else if (entry.status === "missing") reason = "omission";
  else if (entry.status === "extra") reason = "extra word";
  else reason = "spelling/word error";

  return {
    ...entry,
    index,
    original: displayOriginal,
    typed: displayTyped,
    errorType: halfMistake ? "half" : "full",
    reason,
  };
}

export function scoreHighCourtTest(
  type: HighCourtPaper,
  originalText: string,
  typedText: string,
): ScoringResult {
  const originalTokens = tokenize(originalText, type === "shorthand");
  const typedTokens = tokenize(typedText, type === "shorthand");
  const entries = alignPassage(originalTokens, typedTokens)
    .map((entry, index) => classifyEntry(type, entry, index));

  if (type === "typing") {
    const mismatchCount = styleMismatchCount(originalText, typedText);
    for (let mismatch = 0; mismatch < mismatchCount; mismatch++) {
      entries.push({
        index: entries.length,
        original: "formatting",
        typed: "formatting",
        status: "substitution",
        errorType: "full",
        reason: "bold/italic/underline formatting difference",
      });
    }
  }

  const fullMistakes = entries.filter((entry) => entry.errorType === "full").length;
  const halfMistakes = entries.filter((entry) => entry.errorType === "half").length;
  const maximumMarks = type === "shorthand" ? 200 : 100;
  const deduction = type === "typing"
    ? fullMistakes * 0.2
    : type === "pitman"
      ? fullMistakes * 0.4
      : fullMistakes * 0.4 + halfMistakes * 0.2;

  return {
    marks: Math.max(0, maximumMarks - deduction),
    fullMistakes,
    halfMistakes,
    alignmentData: JSON.stringify(entries),
  };
}