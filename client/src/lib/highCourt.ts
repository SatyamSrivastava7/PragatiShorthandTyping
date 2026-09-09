export type HighCourtTestType = "typing" | "pitman" | "shorthand";

export interface HighCourtTest {
  id: number;
  testSetId: number;
  type: HighCourtTestType;
  title: string;
  text: string;
  duration: number;
  pdfFile?: string | null;
  youtubeLink?: string | null;
  createdAt?: string;
}

export interface HighCourtTestSet {
  id: number;
  title: string;
  dateFor: string;
  isEnabled: boolean;
  createdAt: string;
  tests: HighCourtTest[];
}

export interface HighCourtPage<T> {
  items: T[];
  hasMore: boolean;
  offset: number;
  limit: number;
}

export interface HighCourtAlignmentEntry {
  original: string;
  typed: string;
  status: "match" | "substitution" | "missing" | "extra";
  severity: "full" | "half" | "none";
  reason?: string;
}

export interface HighCourtAttempt {
  id: number;
  testSetId: number;
  testId: number;
  testType: HighCourtTestType;
  testTitle: string;
  originalText: string;
  typedText: string;
  mistakes: string | number;
  halfMistakes: string | number;
  marks: string | number;
  submittedAt: string;
  alignment?: HighCourtAlignmentEntry[];
}

export interface HighCourtGroupedResult {
  testSetId: number;
  testSetTitle: string;
  studentId?: number;
  studentName: string;
  studentDisplayId?: string | null;
  typing: HighCourtAttempt | null;
  pitman: HighCourtAttempt | null;
  shorthand: HighCourtAttempt | null;
  typingMarks: number;
  pitmanMarks: number;
  shorthandMarks: number;
  totalMarks: number;
  complete: boolean;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|nbsp|amp|lt|gt|quot|apos);/gi, (entity, body: string) => {
    const normalized = body.toLowerCase();
    if (normalized === "nbsp") return " ";
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";

    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(codePoint) && codePoint > 0
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

export function cleanHighCourtDisplayText(value: unknown): string {
  let cleaned = String(value ?? "");
  for (let pass = 0; pass < 2; pass++) cleaned = decodeHtmlEntities(cleaned);

  return cleaned
    .replace(/\[\[(?:PARA|HIGH_COURT_PARAGRAPH)\]\]/gi, " ")
    .replace(/<\s*\/?\s*(?:o:p|p|div|br)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\b\/?o:p\b/gi, " ")
    .replace(/(^|\s)¶(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const HIGH_COURT_PAPERS: Array<{ type: HighCourtTestType; label: string; max: number; color: string }> = [
  { type: "typing", label: "Typing", max: 100, color: "from-blue-600 to-indigo-600" },
  { type: "pitman", label: "Pitman", max: 100, color: "from-rose-600 to-red-600" },
  { type: "shorthand", label: "Shorthand", max: 200, color: "from-orange-500 to-amber-600" },
];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || "High Court request failed");
  }
  return response.json();
}

function normalizeSet(raw: any): HighCourtTestSet {
  const source = raw.testSet || raw;
  return {
    ...source,
    title: source.title || source.name,
    dateFor: source.dateFor || source.createdAt?.slice(0, 10) || "",
    tests: (raw.tests || source.tests || []).map((test: any) => ({
      ...test,
      text: test.text || test.originalText || "",
    })),
  };
}

function normalizeSetPage(raw: any): HighCourtPage<HighCourtTestSet> {
  const items = Array.isArray(raw) ? raw : raw.items || [];
  return {
    items: items.map(normalizeSet),
    hasMore: Boolean(raw?.hasMore),
    offset: Number(raw?.offset || 0),
    limit: Number(raw?.limit || items.length),
  };
}

function normalizeAlignment(items: any[] = []): HighCourtAlignmentEntry[] {
  return items.map((entry) => ({
    original: entry.original || "",
    typed: entry.typed || "",
    status: entry.status || (entry.errorType === "ok" ? "match" : !entry.original ? "extra" : !entry.typed ? "missing" : "substitution"),
    severity: entry.errorType === "ok" ? "none" : entry.errorType === "half" ? "half" : "full",
    reason: entry.reason,
  }));
}

function normalizeAttempt(raw: any, type?: HighCourtTestType): HighCourtAttempt {
  const scoring = raw.scoring || raw;
  return {
    ...raw,
    testType: raw.testType || raw.type || type || "typing",
    testTitle: raw.testTitle || raw.title || `${(raw.testType || raw.type || type || "typing").replace(/^./, (c: string) => c.toUpperCase())} Test`,
    mistakes: raw.mistakes ?? raw.fullMistakes ?? scoring.fullMistakes ?? 0,
    halfMistakes: raw.halfMistakes ?? scoring.halfMistakes ?? 0,
    marks: raw.marks ?? scoring.marks ?? 0,
    submittedAt: raw.submittedAt || new Date().toISOString(),
    alignment: normalizeAlignment(raw.alignment || scoring.alignment || []),
  };
}

function normalizeGroupedResult(group: any): HighCourtGroupedResult {
  const paper = (type: HighCourtTestType) => group.results?.[type] ? normalizeAttempt(group.results[type], type) : null;
  const typing = paper("typing");
  const pitman = paper("pitman");
  const shorthand = paper("shorthand");
  return {
    testSetId: group.testSetId,
    testSetTitle: group.testSetTitle || group.testSetName,
    studentId: group.studentId,
    studentName: group.studentName || "Student",
    studentDisplayId: group.studentDisplayId,
    typing, pitman, shorthand,
    typingMarks: Number(typing?.marks || 0),
    pitmanMarks: Number(pitman?.marks || 0),
    shorthandMarks: Number(shorthand?.marks || 0),
    totalMarks: Number(group.totalMarks || 0),
    complete: group.completion === 3,
  };
}

export const highCourtApi = {
  getTestSets: async (options: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return normalizeSetPage(await request<any>(`/api/high-court/test-sets${suffix}`));
  },
  getTestSet: async (id: number) => normalizeSet(await request<any>(`/api/high-court/test-sets/${id}`)),
  getTest: async (id: number) => {
    const test = await request<any>(`/api/high-court/tests/${id}`);
    return { ...test, text: test.text || test.originalText || "" };
  },
  submitAttempt: async (data: { testSetId: number; testId: number; typedText: string }) =>
    normalizeAttempt(await request<any>("/api/high-court/attempts", {
      method: "POST",
      body: JSON.stringify(data),
    })),
  getMyResults: async (options: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const page = await request<any>(`/api/high-court/results/me${suffix}`);
    const items = Array.isArray(page) ? page : page.items || [];
    return {
      items: items.map(normalizeGroupedResult),
      hasMore: Boolean(page?.hasMore),
      offset: Number(page?.offset || 0),
      limit: Number(page?.limit || items.length),
    } satisfies HighCourtPage<HighCourtGroupedResult>;
  },
  getAllResults: async (options: { limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    if (options.offset !== undefined) query.set("offset", String(options.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const page = await request<any>(`/api/high-court/results${suffix}`);
    const items = Array.isArray(page) ? page : page.items || [];
    return {
      items: items.map(normalizeGroupedResult),
      hasMore: Boolean(page?.hasMore),
      offset: Number(page?.offset || 0),
      limit: Number(page?.limit || items.length),
    } satisfies HighCourtPage<HighCourtGroupedResult>;
  },
  updateTestSet: async (id: number, data: { name?: string; dateFor?: string; isEnabled?: boolean }) =>
    request<HighCourtTestSet>(`/api/high-court/test-sets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTestSet: async (id: number) =>
    request<{ success: boolean }>(`/api/high-court/test-sets/${id}`, { method: "DELETE" }),
  updateTest: async (id: number, data: { title?: string; originalText?: string; duration?: number; pdfFile?: string; youtubeLink?: string | null }) =>
    request<HighCourtTest>(`/api/high-court/tests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createTestSet: async (data: {
    title: string;
    dateFor: string;
    typing: { title: string; text: string; duration: number };
    pitman: { title: string; text: string; duration: number; pdfFile?: string };
    shorthand: { title: string; text: string; duration: number; youtubeLink?: string };
  }) => normalizeSet(await request<any>("/api/high-court/test-sets", {
    method: "POST",
    body: JSON.stringify({
      name: data.title,
      dateFor: data.dateFor,
      tests: [
        { type: "typing", title: data.typing.title, originalText: data.typing.text, duration: data.typing.duration },
        { type: "pitman", title: data.pitman.title, originalText: data.pitman.text, duration: data.pitman.duration, pdfFile: data.pitman.pdfFile },
        { type: "shorthand", title: data.shorthand.title, originalText: data.shorthand.text, duration: data.shorthand.duration, youtubeLink: data.shorthand.youtubeLink },
      ],
    }),
  })),
};