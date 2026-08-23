export type HighCourtTestType = "typing" | "pitman" | "shorthand";

export interface HighCourtTest {
  id: number;
  testSetId: number;
  type: HighCourtTestType;
  title: string;
  text: string;
  duration: number;
  pdfFile?: string | null;
  createdAt?: string;
}

export interface HighCourtTestSet {
  id: number;
  title: string;
  isEnabled: boolean;
  createdAt: string;
  tests: HighCourtTest[];
}

export interface HighCourtAlignmentEntry {
  original: string;
  typed: string;
  status: "match" | "substitution" | "missing" | "extra";
  severity: "full" | "half" | "none";
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
  studentName: string;
  typing: HighCourtAttempt | null;
  pitman: HighCourtAttempt | null;
  shorthand: HighCourtAttempt | null;
  typingMarks: number;
  pitmanMarks: number;
  shorthandMarks: number;
  totalMarks: number;
  complete: boolean;
}

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
    tests: (raw.tests || source.tests || []).map((test: any) => ({
      ...test,
      text: test.text || test.originalText || "",
    })),
  };
}

function normalizeAlignment(items: any[] = []): HighCourtAlignmentEntry[] {
  return items.map((entry) => ({
    original: entry.original || "",
    typed: entry.typed || "",
    status: entry.errorType === "ok" ? "match" : !entry.original ? "extra" : !entry.typed ? "missing" : "substitution",
    severity: entry.errorType === "ok" ? "none" : entry.errorType === "half" ? "half" : "full",
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

export const highCourtApi = {
  getTestSets: async () => (await request<any[]>("/api/high-court/test-sets")).map(normalizeSet),
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
  getMyResults: async () => (await request<any[]>("/api/high-court/results/me")).map((group) => {
    const paper = (type: HighCourtTestType) => group.results?.[type] ? normalizeAttempt(group.results[type], type) : null;
    const typing = paper("typing");
    const pitman = paper("pitman");
    const shorthand = paper("shorthand");
    return {
      testSetId: group.testSetId,
      testSetTitle: group.testSetTitle || group.testSetName,
      studentName: group.studentName || "Student",
      typing, pitman, shorthand,
      typingMarks: Number(typing?.marks || 0),
      pitmanMarks: Number(pitman?.marks || 0),
      shorthandMarks: Number(shorthand?.marks || 0),
      totalMarks: Number(group.totalMarks || 0),
      complete: group.completion === 3,
    };
  }),
  createTestSet: async (data: {
    title: string;
    typing: { title: string; text: string; duration: number };
    pitman: { title: string; text: string; duration: number; pdfFile?: string };
    shorthand: { title: string; text: string; duration: number };
  }) => normalizeSet(await request<any>("/api/high-court/test-sets", {
    method: "POST",
    body: JSON.stringify({
      name: data.title,
      tests: [
        { type: "typing", title: data.typing.title, originalText: data.typing.text, duration: data.typing.duration },
        { type: "pitman", title: data.pitman.title, originalText: data.pitman.text, duration: data.pitman.duration, pdfFile: data.pitman.pdfFile },
        { type: "shorthand", title: data.shorthand.title, originalText: data.shorthand.text, duration: data.shorthand.duration },
      ],
    }),
  })),
};