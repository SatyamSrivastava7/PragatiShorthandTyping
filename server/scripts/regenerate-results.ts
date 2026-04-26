/**
 * Script to regenerate metrics for results
 *
 * By default it processes the most recent 500 results (all types).
 * To recalc only the first 50 shorthand results, pass the `--shorthand`
 * flag:
 *
 *   npx tsx server/scripts/regenerate-results.ts --shorthand
 *
 * This is useful after updating alignment/metrics logic so existing
 * shorthand entries can be corrected without touching typing results.
 */

import { db } from "../db";
import { results, content } from "../../shared/schema";
import { desc, eq } from "drizzle-orm";

const PARA_TOKEN = '[[PARA]]';
const SPLIT_CHAR_PATTERN = /[-–—\/\\:;|+&_~]/;

function stripHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripHtml(html: string): string {
  if (!html) return '';
  // Replace tags with a space (not empty) so adjacent words across
  // block boundaries (e.g. </div><div>) don't merge into one word.
  let s = html.replace(/<[^>]+>/g, ' ');
  s = stripHtmlEntities(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function stripHtmlPreserveParagraphs(html: string): string {
  if (!html) return '';
  let s = html.replace(/<\s*br\s*\/?>/gi, '\n\n')
              .replace(/<\s*\/\s*p\s*>/gi, '\n\n')
              .replace(/<\s*p[^>]*>/gi, '\n\n')
              .replace(/<\s*\/\s*div\s*>/gi, '\n\n')
              .replace(/<\s*div[^>]*>/gi, '\n\n');
  // Replace remaining inline tags with a space so words don't merge.
  s = s.replace(/<[^>]+>/g, ' ');
  s = stripHtmlEntities(s);
  s = s.replace(/\r\n|\r/g, '\n');
  s = s.replace(/\n+/g, ` ${PARA_TOKEN} `);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeForComparison(text: string): string {
  return text
    .replace(/\.\.\./g, "…")
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'")
    .toLowerCase();
}

function removeParaTokens(text: string): string {
  if (!text) return '';
  return text.replace(/\[\[PARA\]\]/g, '');
}

type AlignmentStatus = "match" | "substitution" | "missing" | "extra" | "trailing";

interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

function fixPrecedingMissingAsTrailing(alignment: AlignmentEntry[]): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  const result = [...alignment];
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") {
      lastTypedIdx = i;
      break;
    }
  }
  if (lastTypedIdx === -1) return result;
  if (result[lastTypedIdx].status === "substitution") {
    for (let j = lastTypedIdx - 1; j >= 0; j--) {
      if (result[j].status === "missing") {
        result[j] = { ...result[j], status: "trailing", isError: false };
      } else {
        break;
      }
    }
  }
  return result;
}

function fixTrailingErrorPattern(alignment: AlignmentEntry[], typedWordCount: number): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  
  let result = [...alignment];
  
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") {
      lastTypedIdx = i;
      break;
    }
  }
  
  if (lastTypedIdx === -1) return result;
  
  for (let i = lastTypedIdx + 1; i < result.length; i++) {
    if (result[i].status === "missing") {
      result[i] = { ...result[i], status: "trailing", isError: false };
    }
  }
  
  let i = 0;
  while (i < result.length) {
    if (result[i].status === "missing") {
      let missingStart = i;
      let missingCount = 0;
      
      while (i < result.length && result[i].status === "missing") {
        missingCount++;
        i++;
      }
      
      if (i < result.length && result[i].typed !== "" && result[i].status === "extra" && missingCount > 2) {
        const typedWord = result[i].typed;
        const originalWord = result[missingStart].original;
        
        result[missingStart] = {
          typed: typedWord,
          original: originalWord,
          status: "substitution",
          isError: true,
        };
        
        for (let j = missingStart + 1; j < i; j++) {
          if (result[j].status === "missing") {
            result[j] = { ...result[j], status: "trailing", isError: false };
          }
        }
        
        result.splice(i, 1);
      }
    } else {
      i++;
    }
  }
  
  lastTypedIdx = -1;
  for (let j = result.length - 1; j >= 0; j--) {
    if (result[j].typed !== "") {
      lastTypedIdx = j;
      break;
    }
  }
  
  if (lastTypedIdx !== -1) {
    for (let j = lastTypedIdx + 1; j < result.length; j++) {
      if (result[j].status === "missing") {
        result[j] = { ...result[j], status: "trailing", isError: false };
      }
    }
    
    if (result[lastTypedIdx].status === "substitution") {
      for (let j = lastTypedIdx - 1; j >= 0; j--) {
        if (result[j].status === "missing") {
          result[j] = { ...result[j], status: "trailing", isError: false };
        } else {
          break;
        }
      }
    }
    
    if (result[lastTypedIdx].status === "substitution" || result[lastTypedIdx].status === "extra") {
      const lastTypedWord = result[lastTypedIdx].typed;
      const lastTypedNormalized = lastTypedWord.replace(/[.,]/g, "").toLowerCase();
      
      for (let j = lastTypedIdx + 1; j < result.length; j++) {
        if (result[j].status === "trailing" && result[j].original) {
          const trailingNormalized = result[j].original.replace(/[.,]/g, "").toLowerCase();
          
          if (trailingNormalized.startsWith(lastTypedNormalized.substring(0, 3)) || 
              lastTypedNormalized.startsWith(trailingNormalized.substring(0, 3))) {
            const betterOriginal = result[j].original;
            
            result[lastTypedIdx] = {
              typed: lastTypedWord,
              original: betterOriginal,
              status: "substitution",
              isError: true,
            };
            
            result.splice(j, 1);
            break;
          }
        }
      }
    }
  }
  
  return result;
}

function alignWordsDP(originalWords: string[], typedWords: string[]): AlignmentEntry[] {
  const n = originalWords.length;
  const m = typedWords.length;

  const normalizedOriginal = originalWords.map(normalizeForComparison);
  const normalizedTyped = typedWords.map(normalizeForComparison);

  const dp: number[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  const result: AlignmentEntry[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      
      if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "match",
          isError: false,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
        result.unshift({
          typed: typedWords[j - 1],
          original: originalWords[i - 1],
          status: "substitution",
          isError: true,
        });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j] + 1) {
        result.unshift({
          typed: "",
          original: originalWords[i - 1],
          status: "missing",
          isError: true,
        });
        i--;
      } else {
        result.unshift({
          typed: typedWords[j - 1],
          original: "",
          status: "extra",
          isError: true,
        });
        j--;
      }
    } else if (i > 0) {
      result.unshift({
        typed: "",
        original: originalWords[i - 1],
        status: "missing",
        isError: true,
      });
      i--;
    } else {
      result.unshift({
        typed: typedWords[j - 1],
        original: "",
        status: "extra",
        isError: true,
      });
      j--;
    }
  }

  return result;
}

function fixLocalMisalignment(alignment: AlignmentEntry[]): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;

  const result: AlignmentEntry[] = [];
  let i = 0;

  while (i < alignment.length) {
    if (alignment[i].status === "match" || alignment[i].status === "trailing") {
      result.push(alignment[i]);
      i++;
      continue;
    }

    const blockStart = i;
    while (i < alignment.length && alignment[i].status !== "match" && alignment[i].status !== "trailing") {
      i++;
    }
    const block = alignment.slice(blockStart, i);

    const blockOriginals: string[] = [];
    const blockTyped: string[] = [];
    for (const entry of block) {
      if (entry.original) blockOriginals.push(entry.original);
      if (entry.typed) blockTyped.push(entry.typed);
    }

    if (blockOriginals.length > 0 && blockTyped.length > 0) {
      const normalizedOrig = blockOriginals.map(normalizeForComparison);
      const normalizedTyp = blockTyped.map(normalizeForComparison);

      const hasMatchableWords = normalizedTyp.some(tw => normalizedOrig.includes(tw));

      if (hasMatchableWords && (blockOriginals.length > 1 || blockTyped.length > 1)) {
        const localAlignment = alignWordsDP(blockOriginals, blockTyped);
        result.push(...localAlignment);
      } else {
        result.push(...block);
      }
    } else {
      result.push(...block);
    }
  }

  return result;
}

function alignWordsWindowed(originalWords: string[], typedWords: string[]): AlignmentEntry[] {
  const WINDOW_SIZE = 200;
  const OVERLAP = 50;
  const result: AlignmentEntry[] = [];
  
  let origIndex = 0;
  let typedIndex = 0;

  while (origIndex < originalWords.length || typedIndex < typedWords.length) {
    const origEnd = Math.min(origIndex + WINDOW_SIZE, originalWords.length);
    const typedEnd = Math.min(typedIndex + WINDOW_SIZE, typedWords.length);
    
    const origWindow = originalWords.slice(origIndex, origEnd);
    const typedWindow = typedWords.slice(typedIndex, typedEnd);

    if (origWindow.length === 0 && typedWindow.length === 0) break;

    const windowAlignment = alignWordsDP(origWindow, typedWindow);
    
    let anchorIdx = windowAlignment.length;
    if (origEnd < originalWords.length || typedEnd < typedWords.length) {
      for (let i = Math.max(0, windowAlignment.length - OVERLAP); i < windowAlignment.length; i++) {
        if (windowAlignment[i].status === "match") {
          anchorIdx = i + 1;
        }
      }
    }

    for (let i = 0; i < anchorIdx; i++) {
      result.push(windowAlignment[i]);
    }

    let origConsumed = 0;
    let typedConsumed = 0;
    for (let i = 0; i < anchorIdx; i++) {
      if (windowAlignment[i].original !== "") origConsumed++;
      if (windowAlignment[i].typed !== "") typedConsumed++;
    }

    origIndex += origConsumed;
    typedIndex += typedConsumed;

    if (origConsumed === 0 && typedConsumed === 0) {
      if (origIndex < originalWords.length) {
        result.push({
          typed: "",
          original: originalWords[origIndex],
          status: "missing",
          isError: true,
        });
        origIndex++;
      } else if (typedIndex < typedWords.length) {
        result.push({
          typed: typedWords[typedIndex],
          original: "",
          status: "extra",
          isError: true,
        });
        typedIndex++;
      }
    }
  }

  return result;
}

function alignWords(originalText: string, typedText: string): AlignmentEntry[] {
  const originalWords = (originalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);

  const n = originalWords.length;
  const m = typedWords.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) {
    return typedWords.map((w) => ({
      typed: w, original: "", status: "extra" as AlignmentStatus, isError: true,
    }));
  }
  if (m === 0) {
    return originalWords.map((w) => ({
      typed: "", original: w, status: "missing" as AlignmentStatus, isError: true,
    }));
  }

  const MAX_DP_SIZE = 500;
  if (n > MAX_DP_SIZE || m > MAX_DP_SIZE) {
    const windowed = alignWordsWindowed(originalWords, typedWords);
    return fixLocalMisalignment(windowed);
  }

  return fixLocalMisalignment(alignWordsDP(originalWords, typedWords));
}

function calculateAlignedMistakes(originalText: string, typedText: string) {
  const plainOriginalText = stripHtml(originalText || '');
  const alignment = alignWords(plainOriginalText, typedText);
  
  let lastTypedIndex = -1;
  for (let i = alignment.length - 1; i >= 0; i--) {
    if (alignment[i].typed !== "") {
      lastTypedIndex = i;
      break;
    }
  }
  
  let trailingWords = 0;
  for (let i = lastTypedIndex + 1; i < alignment.length; i++) {
    if (alignment[i].original) {
      trailingWords++;
    }
  }
  
  if (lastTypedIndex === -1) {
    const totalOriginalWords = (plainOriginalText || "")
      .trim()
      .split(/\s+/)
      .filter(w => w).length;
    return { mistakes: 0, alignment, attemptedAlignment: [], trailingWords: totalOriginalWords };
  }
  
  let attemptedOriginal = "";
  let attemptedTyped = "";
  
  for (let i = 0; i <= lastTypedIndex; i++) {
    const item = alignment[i];
    attemptedTyped += item.typed;
    attemptedOriginal += item.original;
    if (i < lastTypedIndex) {
      attemptedTyped += " ";
      attemptedOriginal += " ";
    }
  }
  
  let attemptedAlignment = alignWords(attemptedOriginal, attemptedTyped);
  attemptedAlignment = fixPrecedingMissingAsTrailing(attemptedAlignment);

  let mistakes = 0;
  
  const normalizeEllipsis = (word: string) => word.replace(/\.\.\./g, "…");
  const commaCount = (word: string) => (normalizeEllipsis(word).match(/,/g) || []).length;
  const periodCount = (word: string) => (normalizeEllipsis(word).match(/\./g) || []).length;

  for (const item of attemptedAlignment) {
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
      continue;
    }

    if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
    } else if (item.status === "extra") {
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
    } else if (item.status === "substitution") {
      const cleanOriginal = normalizeEllipsis(item.original).replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = normalizeEllipsis(item.typed).replace(/[.,]/g, "").toLowerCase();
      if (cleanOriginal !== cleanTyped) mistakes += 1;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    } else if (item.status === "match") {
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
    }
  }

  return { mistakes, alignment, attemptedAlignment, trailingWords };
}

function calculateTypingMetrics(originalText: string, typedText: string, timeInMinutes: number, backspaces: number) {
  const plainOriginalText = stripHtml(originalText || '');
  const originalWords = (plainOriginalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);
  
  const alignmentWindow = Math.min(originalWords.length, typedWords.length + 5);
  const windowedOriginal = originalWords.slice(0, alignmentWindow).join(" ");
  
  const rawAlignment = alignWords(windowedOriginal, typedText);
  const alignment = fixTrailingErrorPattern(rawAlignment, typedWords.length);

  const normalizeEllipsis2 = (word: string) => word.replace(/\.\.\./g, "…");
  const commaCount = (word: string) => (normalizeEllipsis2(word).match(/,/g) || []).length;
  const periodCount = (word: string) => (normalizeEllipsis2(word).match(/\./g) || []).length;

  let mistakes = 0;
  let halfMistakes = 0;
  
  for (const item of alignment) {
    if (item.status === "trailing") continue;
    
    if (item.status === "extra") {
      mistakes += 1;
      mistakes += commaCount(item.typed) * 0.25;
      mistakes += periodCount(item.typed) * 1;
      halfMistakes += commaCount(item.typed);
    } else if (item.status === "substitution") {
      const cleanOriginal = normalizeEllipsis2(item.original).replace(/[.,]/g, "").toLowerCase();
      const cleanTyped = normalizeEllipsis2(item.typed).replace(/[.,]/g, "").toLowerCase();
      if (cleanOriginal !== cleanTyped) mistakes += 1;
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
      halfMistakes += Math.abs(commaCount(item.original) - commaCount(item.typed));
    } else if (item.status === "match") {
      mistakes += Math.abs(commaCount(item.original) - commaCount(item.typed)) * 0.25;
      mistakes += Math.abs(periodCount(item.original) - periodCount(item.typed)) * 1;
      halfMistakes += Math.abs(commaCount(item.original) - commaCount(item.typed));
    } else if (item.status === "missing") {
      mistakes += 1;
      mistakes += commaCount(item.original) * 0.25;
      mistakes += periodCount(item.original) * 1;
      halfMistakes += commaCount(item.original);
    }
  }

  const wordCount = alignment.filter(a => a.typed !== "" && a.original !== PARA_TOKEN && a.typed !== PARA_TOKEN).length;
  const grossSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;

  let netSpeed = 0;
  if (mistakes > timeInMinutes) {
    const penalty = (mistakes - timeInMinutes) * timeInMinutes;
    netSpeed = (wordCount - penalty) / timeInMinutes;
  } else {
    netSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  }
  netSpeed = Math.max(0, netSpeed);

  const formatSpeed = (speed: number) => {
    const rounded = Math.round(speed * 100) / 100;
    return Number.isInteger(rounded) ? rounded : rounded.toFixed(2);
  };

  return {
    words: wordCount,
    mistakes,
    halfMistakes,
    grossSpeed: formatSpeed(grossSpeed),
    netSpeed: formatSpeed(netSpeed),
    backspaces,
  };
}

function calculateShorthandMetrics(originalText: string, typedText: string, timeInMinutes: number) {
  const plainText = stripHtml(originalText || '');
  const { mistakes, attemptedAlignment, trailingWords } = calculateAlignedMistakes(plainText, typedText);

  const fullOriginalWords = (plainText || "").trim().split(/\s+/).filter((w) => w).length;

  const typedWordCount = (typedText || "").trim().split(/\s+/).filter(w => w).length;
  
  if (typedWordCount === 0) {
    return {
      words: fullOriginalWords,
      mistakes: fullOriginalWords,
      halfMistakes: 0,
      result: "Fail",
      missingWords: 0,
      trailingWords: fullOriginalWords,
      fullOriginalWords,
    };
  }

  const totalMistakes = mistakes + trailingWords;

  const mistakePercentage = fullOriginalWords > 0 ? (totalMistakes / fullOriginalWords) * 100 : 0;
  
  const isPassed = mistakePercentage <= 5;

  const missingWords = attemptedAlignment.filter(
    (a) => a.status === "missing"
  ).length;

  let halfMistakes = 0;

  function normalizeEllipsisSH(word: string) {
    return word.replace(/\.\.\./g, "…");
  }

  for (const item of attemptedAlignment) {
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) continue;

    if (item.status === "missing") {
      halfMistakes += (normalizeEllipsisSH(item.original).match(/,/g) || []).length;
    } else if (item.status === "extra") {
      halfMistakes += (normalizeEllipsisSH(item.typed).match(/,/g) || []).length;
    } else {
      halfMistakes += Math.abs(
        (normalizeEllipsisSH(item.original).match(/,/g) || []).length - 
        (normalizeEllipsisSH(item.typed).match(/,/g) || []).length
      );
    }
  }

  return {
    words: typedWordCount,
    mistakes: totalMistakes,
    halfMistakes,
    result: isPassed ? "Pass" : "Fail",
    missingWords,
    trailingWords,
    fullOriginalWords,
  };
}

async function regenerateResults() {
  // Parse CLI flags. Examples:
  //   --shorthand           -> only shorthand
  //   --allahabad-hc        -> only allahabad-hc
  //   (no args)             -> typing, shorthand, pitman (default behaviour)
  const args = process.argv.slice(2);
  const allTypes = ["typing", "shorthand", "pitman", "allahabad-hc"];
  const flagged = allTypes.filter((t) => args.includes(`--${t}`));
  const testTypes = flagged.length > 0 ? flagged : ["typing", "shorthand", "pitman"];

  console.log(`Regenerating results for: ${testTypes.join(", ")}\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const testType of testTypes) {
    console.log(`\n=== Processing ${testType} tests ===`);
    
    // Get latest 50 results of this type (ordered by submitted_at DESC = latest first)
    const testResults = await db
      .select()
      .from(results)
      .where(eq(results.contentType, testType))
      .orderBy(desc(results.submittedAt))
      .limit(50);

    console.log(`Found ${testResults.length} ${testType} results to process.`);

    let updated = 0;
    let skipped = 0;

    for (const result of testResults) {
      // Database stores text in 4 forms:
      // 1. originalText/typedText: AS-IS with HTML formatting and PARA_TOKEN (for display)
      // 2. originalTextClean/typedTextClean: no HTML, no PARA_TOKEN (for metrics calculation)
      
      // For alignment in display: stripHtml removes HTML but keeps PARA_TOKEN to align at word level
      // For metrics: removeParaTokens removes both HTML and PARA_TOKEN to get pure text
      const regeneratedOriginalClean = removeParaTokens(stripHtml(result.originalText || ''));
      const regeneratedTypedClean = removeParaTokens(stripHtml(result.typedText || ''));

      // Use regenerated clean text for metrics calculation
      const originalTextForMetrics = regeneratedOriginalClean;
      const typedTextForMetrics = regeneratedTypedClean;

      if (!originalTextForMetrics || !typedTextForMetrics) {
        console.log(`Skipping result ${result.id} - missing text data`);
        skipped++;
        continue;
      }

      // The live tests pass `testContent.duration` (minutes) into
      // calculateTypingMetrics for gross/net speed. Match that exactly so
      // recalculation reproduces the same speed numbers.
      const [contentRow] = await db
        .select({ duration: content.duration })
        .from(content)
        .where(eq(content.id, result.contentId));

      if (!contentRow) {
        console.log(`Skipping result ${result.id} - content ${result.contentId} not found`);
        skipped++;
        continue;
      }

      const timeInMinutes = contentRow.duration;
      
      try {
        if (testType === "typing" || testType === "pitman" || testType === "allahabad-hc") {
          // Both typing and pitman use same metrics calculation
          const metrics = calculateTypingMetrics(
            originalTextForMetrics,
            typedTextForMetrics,
            timeInMinutes,
            result.backspaces || 0
          );

          // For pass/fail: use 5% mistake rule
          const mistakePercentage = metrics.words > 0 ? (metrics.mistakes / metrics.words) * 100 : 0;
          const resultStatus = mistakePercentage > 5 ? 'Fail' : 'Pass';

          await db
            .update(results)
            .set({
              originalTextClean: regeneratedOriginalClean,
              typedTextClean: regeneratedTypedClean,
              words: metrics.words,
              mistakes: String(metrics.mistakes),
              halfMistakes: String(metrics.halfMistakes),
              grossSpeed: String(metrics.grossSpeed),
              netSpeed: String(metrics.netSpeed),
              result: resultStatus,
            })
            .where(eq(results.id, result.id));

          console.log(`  Result ${result.id}: ${metrics.words} words, ${metrics.mistakes} mistakes, ${metrics.netSpeed} WPM, ${resultStatus}`);
          updated++;
        } else if (testType === "shorthand") {
          const metrics = calculateShorthandMetrics(
            originalTextForMetrics,
            typedTextForMetrics,
            timeInMinutes
          );

          await db
            .update(results)
            .set({
              originalTextClean: regeneratedOriginalClean,
              typedTextClean: regeneratedTypedClean,
              words: metrics.words,
              mistakes: String(metrics.mistakes),
              halfMistakes: String(metrics.halfMistakes),
              result: metrics.result,
            })
            .where(eq(results.id, result.id));

          console.log(`  Result ${result.id}: ${metrics.words} words, ${metrics.mistakes} mistakes, ${metrics.result}`);
          updated++;
        }
      } catch (error) {
        console.error(`  Error processing result ${result.id}:`, error);
        skipped++;
      }
    }

    console.log(`${testType}: Updated ${updated}, Skipped ${skipped}`);
    totalUpdated += updated;
    totalSkipped += skipped;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total Updated: ${totalUpdated}`);
  console.log(`Total Skipped: ${totalSkipped}`);
  console.log(`Done!`);
  process.exit(0);
}

regenerateResults().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
