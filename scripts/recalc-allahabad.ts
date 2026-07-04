import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PARA_TOKEN = "[[PARA]]";
const APPLY = process.argv.includes("--apply");

type AlignmentStatus = "match" | "substitution" | "missing" | "extra" | "trailing";
interface AlignmentEntry {
  typed: string;
  original: string;
  status: AlignmentStatus;
  isError: boolean;
}

function stripHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'");
}

function stripHtml(html: string): string {
  if (!html) return "";
  let s = html.replace(/<[^>]+>/g, "");
  s = stripHtmlEntities(s);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normalizeForComparison(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\.\.\./g, "…")
    .replace(/[\u2010-\u2015\u2212\u2E3A\u2E3B\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB\uFF02]/g, '"')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'")
    .toLowerCase();
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
        dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
      }
    }
  }
  const result: AlignmentEntry[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const isMatch = normalizedOriginal[i - 1] === normalizedTyped[j - 1];
      if (isMatch && dp[i][j] === dp[i - 1][j - 1]) {
        result.unshift({ typed: typedWords[j - 1], original: originalWords[i - 1], status: "match", isError: false });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
        result.unshift({ typed: typedWords[j - 1], original: originalWords[i - 1], status: "substitution", isError: true });
        i--; j--;
      } else if (dp[i][j] === dp[i - 1][j] + 1) {
        result.unshift({ typed: "", original: originalWords[i - 1], status: "missing", isError: true });
        i--;
      } else {
        result.unshift({ typed: typedWords[j - 1], original: "", status: "extra", isError: true });
        j--;
      }
    } else if (i > 0) {
      result.unshift({ typed: "", original: originalWords[i - 1], status: "missing", isError: true });
      i--;
    } else {
      result.unshift({ typed: typedWords[j - 1], original: "", status: "extra", isError: true });
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
      const hasMatchableWords = normalizedTyp.some((tw) => normalizedOrig.includes(tw));
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
        if (windowAlignment[i].status === "match") anchorIdx = i + 1;
      }
    }
    for (let i = 0; i < anchorIdx; i++) result.push(windowAlignment[i]);
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
        result.push({ typed: "", original: originalWords[origIndex], status: "missing", isError: true });
        origIndex++;
      } else if (typedIndex < typedWords.length) {
        result.push({ typed: typedWords[typedIndex], original: "", status: "extra", isError: true });
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
  if (n === 0) return typedWords.map((w) => ({ typed: w, original: "", status: "extra" as AlignmentStatus, isError: true }));
  if (m === 0) return originalWords.map((w) => ({ typed: "", original: w, status: "missing" as AlignmentStatus, isError: true }));
  const MAX_DP_SIZE = 500;
  if (n > MAX_DP_SIZE || m > MAX_DP_SIZE) {
    const windowed = alignWordsWindowed(originalWords, typedWords);
    return fixLocalMisalignment(windowed);
  }
  return fixLocalMisalignment(alignWordsDP(originalWords, typedWords));
}

function fixTrailingErrorPattern(alignment: AlignmentEntry[]): AlignmentEntry[] {
  if (alignment.length === 0) return alignment;
  let result = [...alignment];
  let lastTypedIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].typed !== "") { lastTypedIdx = i; break; }
  }
  if (lastTypedIdx === -1) return result;
  for (let i = lastTypedIdx + 1; i < result.length; i++) {
    if (result[i].status === "missing") result[i] = { ...result[i], status: "trailing", isError: false };
  }
  let i = 0;
  while (i < result.length) {
    if (result[i].status === "missing") {
      const missingStart = i;
      let missingCount = 0;
      while (i < result.length && result[i].status === "missing") { missingCount++; i++; }
      if (i < result.length && result[i].typed !== "" && result[i].status === "extra" && missingCount > 2) {
        const typedWord = result[i].typed;
        const originalWord = result[missingStart].original;
        result[missingStart] = { typed: typedWord, original: originalWord, status: "substitution", isError: true };
        for (let j = missingStart + 1; j < i; j++) {
          if (result[j].status === "missing") result[j] = { ...result[j], status: "trailing", isError: false };
        }
        result.splice(i, 1);
      }
    } else {
      i++;
    }
  }
  lastTypedIdx = -1;
  for (let j = result.length - 1; j >= 0; j--) {
    if (result[j].typed !== "") { lastTypedIdx = j; break; }
  }
  if (lastTypedIdx !== -1) {
    for (let j = lastTypedIdx + 1; j < result.length; j++) {
      if (result[j].status === "missing") result[j] = { ...result[j], status: "trailing", isError: false };
    }
    if (result[lastTypedIdx].status === "substitution") {
      for (let j = lastTypedIdx - 1; j >= 0; j--) {
        if (result[j].status === "missing") result[j] = { ...result[j], status: "trailing", isError: false };
        else break;
      }
    }
    if (result[lastTypedIdx].status === "substitution" || result[lastTypedIdx].status === "extra") {
      const lastTypedWord = result[lastTypedIdx].typed;
      const lastTypedNormalized = lastTypedWord.replace(/[.,]/g, "").toLowerCase();
      for (let j = lastTypedIdx + 1; j < result.length; j++) {
        if (result[j].status === "trailing" && result[j].original) {
          const trailingNormalized = result[j].original.replace(/[.,]/g, "").toLowerCase();
          if (
            trailingNormalized.startsWith(lastTypedNormalized.substring(0, 3)) ||
            lastTypedNormalized.startsWith(trailingNormalized.substring(0, 3))
          ) {
            const betterOriginal = result[j].original;
            result[lastTypedIdx] = { typed: lastTypedWord, original: betterOriginal, status: "substitution", isError: true };
            result.splice(j, 1);
            break;
          }
        }
      }
    }
  }
  return result;
}

function getTypingAlignment(originalText: string, typedText: string): AlignmentEntry[] {
  const plainOriginalText = stripHtml(originalText || "");
  const originalWords = (plainOriginalText || "").trim().split(/\s+/).filter((w) => w);
  const typedWords = (typedText || "").trim().split(/\s+/).filter((w) => w);
  if (typedWords.length === 0) {
    return originalWords.map((w) => ({ typed: "", original: w, status: "trailing" as AlignmentStatus, isError: false }));
  }
  const alignmentWindow = Math.min(originalWords.length, typedWords.length + 5);
  const windowedOriginal = originalWords.slice(0, alignmentWindow).join(" ");
  const cleanTypedText = typedWords.join(" ");
  const rawAlignment = alignWords(windowedOriginal, cleanTypedText);
  let result = fixTrailingErrorPattern(rawAlignment);
  for (let i = alignmentWindow; i < originalWords.length; i++) {
    result.push({ typed: "", original: originalWords[i], status: "trailing", isError: false });
  }
  return result;
}

function calculateTypingMistakes(originalText: string, typedText: string) {
  const alignment = getTypingAlignment(originalText, typedText);
  let mistakes = 0;
  let attemptedWords = 0;
  let trailingWords = 0;
  const normalizeEllipsis = (w: string) => w.replace(/\.\.\./g, "…");
  const commaCount = (w: string) => (normalizeEllipsis(w).match(/,/g) || []).length;
  const periodCount = (w: string) => (normalizeEllipsis(w).match(/\./g) || []).length;

  type Breakdown = { idx: number; status: AlignmentStatus; original: string; typed: string; penalty: number; reason: string };
  const breakdown: Breakdown[] = [];

  alignment.forEach((item, idx) => {
    if (item.original === PARA_TOKEN || item.typed === PARA_TOKEN) return;
    if (item.status === "trailing") { trailingWords++; return; }
    let pen = 0;
    let reason = "";
    if (item.status === "extra") {
      attemptedWords++;
      pen += 1; reason += "extra+1 ";
      const c = commaCount(item.typed); const p = periodCount(item.typed);
      if (c) { pen += c * 0.25; reason += `commas(${c})+${c * 0.25} `; }
      if (p) { pen += p * 1; reason += `periods(${p})+${p} `; }
    } else if (item.status === "substitution") {
      attemptedWords++;
      const co = normalizeEllipsis(item.original).replace(/[.,]/g, "").toLowerCase();
      const ct = normalizeEllipsis(item.typed).replace(/[.,]/g, "").toLowerCase();
      if (co !== ct) { pen += 1; reason += "wordSub+1 "; }
      const cd = Math.abs(commaCount(item.original) - commaCount(item.typed));
      const pd = Math.abs(periodCount(item.original) - periodCount(item.typed));
      if (cd) { pen += cd * 0.25; reason += `commaDiff(${cd})+${cd * 0.25} `; }
      if (pd) { pen += pd * 1; reason += `periodDiff(${pd})+${pd} `; }
    } else if (item.status === "match") {
      attemptedWords++;
      const cd = Math.abs(commaCount(item.original) - commaCount(item.typed));
      const pd = Math.abs(periodCount(item.original) - periodCount(item.typed));
      if (cd) { pen += cd * 0.25; reason += `commaDiff(${cd})+${cd * 0.25} `; }
      if (pd) { pen += pd * 1; reason += `periodDiff(${pd})+${pd} `; }
    } else if (item.status === "missing") {
      pen += 1; reason += "missing+1 ";
      const c = commaCount(item.original); const p = periodCount(item.original);
      if (c) { pen += c * 0.25; reason += `commas(${c})+${c * 0.25} `; }
      if (p) { pen += p * 1; reason += `periods(${p})+${p} `; }
    }
    mistakes += pen;
    if (pen > 0) breakdown.push({ idx, status: item.status, original: item.original, typed: item.typed, penalty: pen, reason: reason.trim() });
  });

  return { mistakes, alignment, attemptedWords, trailingWords, breakdown };
}

function calculateTypingMetrics(originalText: string, typedText: string, timeInMinutes: number, backspaces: number) {
  const plainText = stripHtml(originalText || "");
  const { mistakes, alignment, breakdown } = calculateTypingMistakes(plainText, typedText);
  const wordCount = alignment.filter((a) => a.typed !== "").length;
  const grossSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  let netSpeed = 0;
  if (mistakes > timeInMinutes) {
    const penalty = (mistakes - timeInMinutes) * timeInMinutes;
    netSpeed = (wordCount - penalty) / timeInMinutes;
  } else {
    netSpeed = timeInMinutes > 0 ? wordCount / timeInMinutes : 0;
  }
  netSpeed = Math.max(0, netSpeed);
  const formatSpeed = (s: number) => {
    const r = Math.round(s * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  };
  let halfMistakes = 0;
  for (const item of alignment) {
    if (item.status === "trailing") continue;
    if (item.status === "extra") {
      halfMistakes += (item.typed.match(/,/g) || []).length;
    } else if (item.status === "substitution" || item.status === "match") {
      const oc = (item.original.match(/,/g) || []).length;
      const tc = (item.typed.match(/,/g) || []).length;
      halfMistakes += Math.abs(oc - tc);
    }
  }
  return { words: wordCount, mistakes, halfMistakes, grossSpeed: formatSpeed(grossSpeed), netSpeed: formatSpeed(netSpeed), backspaces, breakdown };
}

(async () => {
  const { rows } = await pool.query(
    `SELECT id, student_display_id, content_title, original_text, original_text_clean,
            typed_text, typed_text_clean, words, time, mistakes, half_mistakes, backspaces,
            gross_speed, net_speed, result
     FROM results WHERE content_type = 'allahabad-hc' ORDER BY id`,
  );

  console.log(`\nFound ${rows.length} Allahabad-HC result(s).\n`);
  for (const r of rows) {
    const cleanOrig = (r.original_text_clean || stripHtml(r.original_text || "")).replace(/\[\[PARA\]\]/g, "").replace(/\s+/g, " ").trim();
    const cleanTyped = (r.typed_text_clean || stripHtml(r.typed_text || "")).replace(/\[\[PARA\]\]/g, "").replace(/\s+/g, " ").trim();
    const timeMin = (r.time || 0) / 60;
    const m = calculateTypingMetrics(cleanOrig, cleanTyped, timeMin, r.backspaces || 0);
    const passFail = m.words > 0 && (m.mistakes / m.words) * 100 > 5 ? "Fail" : "Pass";

    console.log(`========== Result id=${r.id}  (${r.student_display_id} — ${r.content_title})  time=${r.time}s ==========`);
    console.log(`  STORED:  words=${r.words}  mistakes=${r.mistakes}  halfMistakes=${r.half_mistakes}  gross=${r.gross_speed}  net=${r.net_speed}  result=${r.result}`);
    console.log(`  RECALC:  words=${m.words}  mistakes=${m.mistakes}  halfMistakes=${m.halfMistakes}  gross=${m.grossSpeed}  net=${m.netSpeed}  result=${passFail}`);
    console.log(`  Per-item penalty breakdown (only items contributing to mistakes):`);
    for (const b of m.breakdown) {
      console.log(`    [#${String(b.idx).padStart(3)}] ${b.status.padEnd(13)} typed="${b.typed}"  orig="${b.original}"  +${b.penalty}  (${b.reason})`);
    }
    console.log(`  TOTAL penalties summed = ${m.breakdown.reduce((s, b) => s + b.penalty, 0)}\n`);

    if (APPLY) {
      await pool.query(
        `UPDATE results SET words=$1, mistakes=$2, half_mistakes=$3, gross_speed=$4, net_speed=$5, result=$6 WHERE id=$7`,
        [m.words, String(m.mistakes), String(m.halfMistakes), m.grossSpeed, m.netSpeed, passFail, r.id],
      );
      console.log(`  ✓ APPLIED to DB.\n`);
    }
  }

  if (!APPLY) console.log(`(dry-run) Re-run with --apply to write changes to the database.\n`);
  await pool.end();
})();
