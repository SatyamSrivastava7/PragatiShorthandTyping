import { cn, getTypingAlignment, calculateAlignedMistakes, PARA_TOKEN, stripHtmlEntities, stripHtml, type AlignmentEntry } from "@/lib/utils";
import type { CSSProperties } from "react";

interface ResultTextAnalysisProps {
  originalText: string;
  typedText: string;
  originalTextClean?: string;
  typedTextClean?: string;
  language?: "english" | "hindi";
  contentType?: "typing" | "shorthand" | "allahabad-hc";
}

interface WordInfo {
  plain: string;
  style: CSSProperties; // inline styles - bypass Tailwind CSS reset
}

interface TypedBlock {
  textAlign?: string; // "center" | "left" | "right" | "justify" | undefined
  words: WordInfo[];
  isEmpty: boolean; // true for [[PARA]] / empty divs used as spacers
}

/** Parse the stored allahabad-hc typedText (inline HTML + [[PARA]] tokens) into paragraph blocks.
 *  Each <div>...</div> becomes one block. Style (text-align) is captured from the div's style attr.
 *  Inline tags (b, i, u, s, em, strong, del) are converted to CSSProperties objects — this
 *  avoids Tailwind's CSS preflight reset which zeroes out font-style and text-decoration.
 */
function parseTypedHtmlIntoBlocks(typedText: string): TypedBlock[] {
  const blocks: TypedBlock[] = [];

  // Replace [[PARA]] tokens with a distinguishable spacer text
  const processed = typedText.replace(/\[\[PARA?\]?\]?|\[\[PAR\]?/g, " __PARA__ ");

  // Split on closing </div> tags to get chunks, each starting (optionally) with an opening <div>
  const chunks = processed.split(/<\/div\s*>/i);

  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;

    // Extract text-align from <div style="...text-align: center;...">
    const alignMatch = chunk.match(/text-align\s*:\s*(\w+)/i);
    const textAlign = alignMatch?.[1]?.toLowerCase();

    // Strip the opening <div...> tag
    const inner = chunk.replace(/^<div[^>]*>/i, "").trim();

    if (!inner || inner === "__PARA__") {
      blocks.push({ isEmpty: true, words: [] });
      continue;
    }

    const words = extractWordsWithInlineStyles(inner);
    blocks.push({ textAlign, words, isEmpty: words.length === 0 });
  }

  return blocks;
}

const INLINE_TAGS = new Set(["strong", "b", "em", "i", "u", "s", "del", "ins", "mark"]);

/** Walk inline HTML and extract each whitespace-separated word together with its CSS style. */
function extractWordsWithInlineStyles(html: string): WordInfo[] {
  const result: WordInfo[] = [];
  const activeTags: string[] = [];
  const tokenRegex = /(<[^>]+>)|(\S+)/g;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(html)) !== null) {
    const token = m[0];

    if (token.startsWith("<")) {
      if (token.startsWith("</")) {
        const tag = token.match(/<\/(\w+)/)?.[1]?.toLowerCase() ?? "";
        if (INLINE_TAGS.has(tag)) {
          const idx = activeTags.lastIndexOf(tag);
          if (idx !== -1) activeTags.splice(idx, 1);
        }
      } else if (!token.endsWith("/>")) {
        const tag = token.match(/<(\w+)/)?.[1]?.toLowerCase() ?? "";
        if (INLINE_TAGS.has(tag)) activeTags.push(tag);
      }
      continue;
    }

    if (token === "__PARA__") continue; // skip para markers inside inline content

    const plain = stripHtmlEntities(token);

    // Build inline style from active tags — explicit CSS beats Tailwind preflight reset
    const style: CSSProperties = {};
    const textDecorations: string[] = [];

    for (const tag of activeTags) {
      if (tag === "b" || tag === "strong") style.fontWeight = "bold";
      if (tag === "i" || tag === "em") style.fontStyle = "italic";
      if (tag === "u") textDecorations.push("underline");
      if (tag === "s" || tag === "del") textDecorations.push("line-through");
    }
    if (textDecorations.length > 0) style.textDecoration = textDecorations.join(" ");

    result.push({ plain, style });
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

  // ── Parse HTML blocks (Allahabad-HC only) ──────────────────────────────────
  // Each block maps to a <div> in the student's typed HTML. Block structure
  // gives us: text-align per paragraph, paragraph breaks, and inline styles.
  const typedBlocks: TypedBlock[] = isAllahabadHC
    ? parseTypedHtmlIntoBlocks(typedText)
    : [];

  // Flat sequential word list (non-empty blocks only, preserving order)
  const allTypedWords: WordInfo[] = typedBlocks.flatMap((b) => b.words);

  // Cumulative word count per block — used to know when to insert paragraph breaks
  const blockWordEnds: number[] = [];
  {
    let running = 0;
    for (const b of typedBlocks) {
      running += b.words.length;
      blockWordEnds.push(running);
    }
  }

  // ── Clean text for alignment ────────────────────────────────────────────────
  const cleanPara = /\[\[PARA?\]?\]?|\[\[PAR\]?/g;

  const alignOriginal = isAllahabadHC
    ? (originalTextClean ?? stripHtml(originalText)).replace(cleanPara, "").replace(/\s+/g, " ").trim()
    : stripHtml(originalText);

  const alignTyped = isAllahabadHC
    ? (typedTextClean ?? stripHtml(typedText)).replace(cleanPara, "").replace(/\s+/g, " ").trim()
    : stripHtml(typedText);

  // ── Alignment ──────────────────────────────────────────────────────────────
  let alignment: AlignmentEntry[];

  if (contentType === "typing" || isAllahabadHC) {
    alignment = getTypingAlignment(alignOriginal, alignTyped);
  } else {
    const { mistakes: _m, attemptedAlignment, alignment: full, trailingWords: _t } =
      calculateAlignedMistakes(alignOriginal, alignTyped);
    const trailing = full.filter(
      (item) =>
        !attemptedAlignment.some(
          (a) => a.original === item.original && a.typed === item.typed && a.status === item.status
        ) && item.original !== ""
    );
    alignment = [...attemptedAlignment, ...trailing];
  }

  // ── Normalize consecutive PARA tokens (typing mode) ────────────────────────
  const normalizedAlignment = alignment.reduce((acc: AlignmentEntry[], item) => {
    const isPara = item.original === PARA_TOKEN || item.typed === PARA_TOKEN;
    if (!isPara) { acc.push(item); return acc; }
    let run = 0;
    for (let j = acc.length - 1; j >= 0; j--) {
      const p = acc[j];
      if (p.original === PARA_TOKEN || p.typed === PARA_TOKEN) run++;
      else break;
    }
    if (run < 2) acc.push(item);
    return acc;
  }, []);

  // ── Enrich alignment with word styles (Allahabad-HC) ───────────────────────
  // For each alignment entry that "consumed" a typed word, look up its style
  // from allTypedWords sequentially.
  // Also pre-compute where paragraph breaks should appear (between blocks).
  type EnrichedEntry = AlignmentEntry & {
    wordStyle?: CSSProperties;
    insertBreakAfter?: boolean; // render a paragraph gap after this word
  };

  let seqIdx = 0; // index into allTypedWords
  const enriched: EnrichedEntry[] = normalizedAlignment.map((item) => {
    // Non-allahabad-hc or no typed word — skip style lookup
    if (!isAllahabadHC || !item.typed || item.typed === PARA_TOKEN) {
      return { ...item };
    }

    const info = allTypedWords[seqIdx];
    const wordStyle: CSSProperties | undefined = info?.style ?? undefined;
    seqIdx++;

    // Detect paragraph break: did we just cross a block boundary?
    let insertBreakAfter = false;
    for (const end of blockWordEnds) {
      if (seqIdx === end && seqIdx < allTypedWords.length) {
        // Check if the next block is an empty/para block
        let blockCursor = 0;
        for (let bi = 0; bi < typedBlocks.length; bi++) {
          blockCursor += typedBlocks[bi].words.length;
          if (blockCursor === seqIdx) {
            // peek ahead: if next blocks are empty before next word block
            for (let ni = bi + 1; ni < typedBlocks.length; ni++) {
              if (typedBlocks[ni].isEmpty) { insertBreakAfter = true; break; }
              break; // first non-empty, check if alignment/center warrants break
            }
            break;
          }
        }
        // Always insert break between blocks that have different alignment or content
        insertBreakAfter = true;
        break;
      }
    }

    return { ...item, wordStyle, insertBreakAfter };
  });

  // ── Render helpers ─────────────────────────────────────────────────────────
  const wrapClass = "inline-block mr-1";
  const fontClass = language === "hindi" ? "font-mangal" : "font-times";

  // Merge base word style with error color overrides
  function makeStyle(wordStyle: CSSProperties | undefined, error: boolean, missing: boolean): CSSProperties {
    if (missing) return { color: "#16a34a", fontWeight: 600 }; // green
    const base: CSSProperties = { ...wordStyle };
    if (error) {
      base.color = "#dc2626"; // red-600
      if (!base.textDecoration) base.textDecoration = "underline";
      else base.textDecoration = `${base.textDecoration} underline`;
    }
    return base;
  }

  // Determine the text-align for the block that owns seqIdx position
  function getBlockAlign(wordIdx: number): string | undefined {
    let cursor = 0;
    for (const b of typedBlocks) {
      cursor += b.words.length;
      if (wordIdx < cursor) return b.textAlign;
    }
    return undefined;
  }

  // ── Group enriched entries into paragraph runs ─────────────────────────────
  // For Allahabad-HC we need per-paragraph divs so text-align works.
  // We do this by splitting enriched entries at insertBreakAfter markers.
  type ParaRun = { align?: string; entries: EnrichedEntry[] };

  function buildParaRuns(): ParaRun[] {
    if (!isAllahabadHC) return [{ entries: enriched }];

    const runs: ParaRun[] = [];
    let current: EnrichedEntry[] = [];
    let wordCount = 0;

    for (const entry of enriched) {
      current.push(entry);
      if (entry.typed && entry.typed !== PARA_TOKEN) wordCount++;

      if (entry.insertBreakAfter) {
        const align = wordCount > 0 ? getBlockAlign(wordCount - 1) : undefined;
        runs.push({ align, entries: current });
        current = [];
      }
    }
    if (current.length > 0) {
      runs.push({ align: getBlockAlign(wordCount - 1), entries: current });
    }
    return runs;
  }

  const paraRuns = buildParaRuns();

  function renderEntry(item: EnrichedEntry, i: number) {
    // Paragraph token (typing/shorthand mode)
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) {
      return <div key={i} className="w-full my-2" />;
    }

    // Trailing — not attempted
    if (item.status === "trailing") {
      return (
        <span key={i} className={cn(wrapClass, "text-muted-foreground/50")}>
          {stripHtmlEntities(item.original)}
        </span>
      );
    }

    // Missing — show original in green brackets
    if (item.status === "missing") {
      return (
        <span key={i} className={wrapClass} style={{ color: "#16a34a", fontWeight: 600 }}>
          [{stripHtmlEntities(item.original)}]
        </span>
      );
    }

    // Substitution — typed word (red + student style) + correct word (green brackets)
    if (item.status === "substitution") {
      const st = makeStyle(item.wordStyle, true, false);
      return (
        <span key={i} className={wrapClass}>
          <span style={{ ...st, marginRight: 2 }} dangerouslySetInnerHTML={{ __html: stripHtmlEntities(item.typed) }} />
          <span style={{ color: "#16a34a", fontWeight: 600 }}>[{stripHtmlEntities(item.original)}]</span>
        </span>
      );
    }

    // Extra — typed but not in original
    if (item.status === "extra") {
      const st = makeStyle(item.wordStyle, true, false);
      return (
        <span key={i} className={wrapClass} style={st}>
          {stripHtmlEntities(item.typed)}
        </span>
      );
    }

    // Match — correct word with student's formatting
    const st = makeStyle(item.wordStyle, false, false);
    const hasStyle = Object.keys(st).length > 0;
    return (
      <span key={i} className={wrapClass} style={hasStyle ? st : undefined}>
        {stripHtmlEntities(item.typed)}
      </span>
    );
  }

  // ── Final render ───────────────────────────────────────────────────────────
  return (
    <div className={cn("text-sm leading-relaxed text-justify", fontClass)}>
      {paraRuns.map((run, ri) => (
        <div
          key={ri}
          style={run.align ? { textAlign: run.align as CSSProperties["textAlign"] } : undefined}
          className={ri > 0 ? "mt-3" : undefined}
        >
          {run.entries.map((item, ei) => renderEntry(item, ei))}
        </div>
      ))}
    </div>
  );
}
