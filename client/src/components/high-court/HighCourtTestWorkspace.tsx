import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowDown, ArrowLeft, CheckCircle2, Clock3, ExternalLink, Loader2, Maximize, Minimize, Save, Type, Youtube, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RichTextEditor } from "@/components/RichTextEditor";
import { highCourtApi, type HighCourtTest, type HighCourtTestType } from "@/lib/highCourt";
import { HighCourtPdfViewer } from "./HighCourtPdfViewer";
import { stripHtmlEntities, stripHtmlPreserveParagraphs, PARA_TOKEN } from "@/lib/utils";
import { scrollActiveMarkerIntoView } from "@/lib/typingAutoScroll";
import { useToast } from "@/hooks/use-toast";

const labels: Record<HighCourtTestType, string> = {
  typing: "Typing Test",
  pitman: "Pitman Test",
  shorthand: "Shorthand Test",
};

const colors: Record<HighCourtTestType, string> = {
  typing: "from-blue-600 to-indigo-600",
  pitman: "from-rose-600 to-red-600",
  shorthand: "from-orange-500 to-amber-600",
};

export function HighCourtTestWorkspace({ expectedType }: { expectedType: HighCourtTestType }) {
  const [, params] = useRoute(`/high-court/${expectedType}/:id`);
  const { toast } = useToast();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);
  const typedTextRef = useRef("");
  const timerEndAtRef = useRef<number | null>(null);
  const submitRef = useRef<(() => Promise<void>) | null>(null);
  const [test, setTest] = useState<HighCourtTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [active, setActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfZoom, setPdfZoom] = useState(100);
  const [fontSize, setFontSize] = useState(18);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [highlighterEnabled, setHighlighterEnabled] = useState(true);
  const [result, setResult] = useState<{ mistakes: string | number; halfMistakes: string | number; marks: string | number } | null>(null);
  const questionPaperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = Number(params?.id);
    if (!id) {
      setLoadError("Invalid High Court test link.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    highCourtApi.getTest(id)
      .then((data) => {
        setTest(data);
        setTimeLeft(data.duration * 60);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Unable to load this test.";
        setLoadError(message);
        toast({ variant: "destructive", title: "Unable to load High Court test", description: message });
      })
      .finally(() => setLoading(false));
  }, [params?.id, toast]);

  useEffect(() => {
    if (expectedType !== "pitman" || !test) {
      setPdfUrl("");
      setPdfError(expectedType === "pitman" && test ? "No PDF has been uploaded for this paper." : "");
      return;
    }

    // Keep the authenticated API URL as the source. The viewer fetches it
    // once and passes the bytes directly to PDF.js; an intermediate blob URL
    // caused student previews to fail after the first download.
    setPdfUrl(`/api/high-court/tests/${test.id}/pdf`);
    setPdfError("");
  }, [expectedType, test?.id]);

  const submit = useCallback(async () => {
    if (!test || submittedRef.current) return;
    submittedRef.current = true;
    setActive(false);
    setSubmitting(true);
    try {
      const saved = await highCourtApi.submitAttempt({
        testSetId: test.testSetId,
        testId: test.id,
          typedText: typedTextRef.current,
      });
      setResult({ mistakes: saved.mistakes, halfMistakes: saved.halfMistakes, marks: saved.marks });
      toast({ title: "High Court test submitted", description: "Your marks were calculated and saved." });
    } catch (error) {
      submittedRef.current = false;
      toast({ variant: "destructive", title: "Submission failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }, [test, toast]);

  useEffect(() => {
    typedTextRef.current = typedText;
  }, [typedText]);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  useEffect(() => {
    if (!active || !test) return;

    const endAt = timerEndAtRef.current ?? (Date.now() + test.duration * 60 * 1000);
    timerEndAtRef.current = endAt;
    let cancelled = false;

    const updateRemainingTime = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        timerRef.current = null;
        void submitRef.current?.();
        return;
      }

      // Recalculate from the absolute end time on every tick. This stays
      // accurate when an older browser throttles timers or briefly sleeps.
      if (!cancelled) {
        timerRef.current = setTimeout(updateRemainingTime, 500);
      }
    };

    const updateWhenVisible = () => {
      if (!document.hidden) updateRemainingTime();
    };

    updateRemainingTime();
    document.addEventListener("visibilitychange", updateWhenVisible);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [active, test]);

  const start = () => {
    if (!test || submittedRef.current) return;
    timerEndAtRef.current = Date.now() + test.duration * 60 * 1000;
    setTimeLeft(test.duration * 60);
    setActive(true);
    questionPaperRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setTimeout(() => document.getElementById(expectedType === "typing" ? "high-court-rich-editor" : "high-court-textarea")?.focus(), 0);
  };

  const updateTypingResponse = (html: string) => {
    setTypedText(html);
  };

  useLayoutEffect(() => {
    if (expectedType !== "typing" || !autoScrollEnabled || !active || !questionPaperRef.current) return;

    const container = questionPaperRef.current;
    const marker = container.querySelector(".current-word-marker") as HTMLElement | null;
    if (!marker) return;

    // Run before paint. The marker is rebuilt on every typed character, so a
    // post-paint animation makes the question paper visibly vibrate.
    scrollActiveMarkerIntoView(container, marker, "auto");
  }, [active, autoScrollEnabled, expectedType, fontSize, highlighterEnabled, test, typedText]);

  const getHighlightedTypingContent = () => {
    if (!test) return "";

    const originalWords = stripHtmlPreserveParagraphs(test.text)
      .trim()
      .split(/\s+/)
      .filter((word) => word && word !== PARA_TOKEN);
    const typedPlainText = stripHtmlPreserveParagraphs(typedText);
    const typedWords = typedPlainText
      .split(/\s+/)
      .filter((word) => word && word !== PARA_TOKEN);
    const hasTrailingWhitespace = /(?:\s|&nbsp;|&#160;|&#xa0;)(?:<\/[^>]+>)*$/i.test(typedText);

    let currentIndex = 0;
    if (typedPlainText.trim() !== "") {
      currentIndex = hasTrailingWhitespace ? typedWords.length : Math.max(0, typedWords.length - 1);
    }

    if (!originalWords.length || currentIndex >= originalWords.length) {
      return test.text;
    }

    const targetWord = originalWords[currentIndex];
    let wordOccurrenceCount = 0;
    let foundTargetWord = false;
    const highlightStyle = highlighterEnabled
      // Keep the marker visual-only. Padding and font-weight changes alter
      // line width on every keystroke and cause the paper to reflow slightly.
      ? "background-color: #fbbf24; border-radius: 2px;"
      : "";

    return test.text
      .split(/(<[^>]+>)/)
      .map((part) => {
        if (part.startsWith("<") || foundTargetWord || !part) return part;

        return part
          .split(/((?:\s|&nbsp;|&#160;|&#xa0;)+)/i)
          .map((segment) => {
            if (foundTargetWord || !segment) return segment;

            const decoded = stripHtmlEntities(segment);
            if (/^\s*$/.test(decoded)) return segment;

            if (decoded === targetWord) {
              if (wordOccurrenceCount === currentIndex) {
                foundTargetWord = true;
                return `<span class="current-word-marker" style="${highlightStyle}">${segment}</span>`;
              }
              wordOccurrenceCount += 1;
            } else {
              wordOccurrenceCount += 1;
            }
            return segment;
          })
          .join("");
      })
      .join("");
  };

  const renderTypingQuestion = () => (
    <div
      className="max-w-none leading-relaxed text-slate-800 [&_div]:my-0 [&_p]:my-0 [&_pre]:m-0 [&_pre]:whitespace-pre-wrap"
      style={{ fontSize, textAlign: "justify" }}
      dangerouslySetInnerHTML={{ __html: getHighlightedTypingContent() }}
    />
  );

  const formatTime = `${Math.floor(timeLeft / 60).toString().padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`;

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div>;
  }

  if (loadError || !test) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-red-600" />
        <p className="font-semibold text-slate-900">Unable to load High Court test</p>
        <p className="mt-1 text-sm text-slate-600">{loadError || "This test is unavailable."}</p>
        <Link href="/student?tab=high-court_tests">
          <Button className="mt-5">Back to High Court tests</Button>
        </Link>
      </div>
    );
  }

  if (test.type !== expectedType) {
    return <div className="mx-auto max-w-xl p-8 text-center"><AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" /><p>This High Court test type does not match this page.</p></div>;
  }

  return (
    <div className={`high-court-workspace ${isFullScreen ? "fixed inset-0 z-[60] h-screen overflow-hidden bg-slate-100 p-3 md:p-4" : "h-full overflow-hidden bg-slate-100 p-3 md:p-4"}`}>
      <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-3">
        <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r ${colors[expectedType]} p-4 text-white shadow-lg`}>
          <div className="flex items-center gap-3">
            <Link href="/student?tab=high-court_tests"><Button variant="secondary" size="icon" aria-label="Back to High Court"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">High Court Assessment</p>
              <h1 className="text-xl font-bold">{test.title}</h1>
              <p className="text-sm text-white/80">{labels[expectedType]} · {test.duration} minutes</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 md:gap-3">
            <Button variant="secondary" size="icon" onClick={() => setIsFullScreen((value) => !value)} title="Toggle full screen">
              {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            <>
              <div className="flex items-center gap-2 rounded-lg bg-white/15 px-2 py-1.5 sm:px-3 sm:py-2">
                <Type className="h-4 w-4" />
                <Slider
                  value={[fontSize]}
                  onValueChange={(value) => setFontSize(value[0])}
                  min={12}
                  max={32}
                  step={2}
                  className="w-16 sm:w-24"
                  aria-label="Response font size"
                />
                <span className="w-8 text-xs">{fontSize}px</span>
              </div>
              {expectedType === "typing" && (
              <>
                <Button
                  type="button"
                  variant={autoScrollEnabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setAutoScrollEnabled((value) => !value)}
                >
                  <ArrowDown className="mr-2 h-4 w-4" />Auto-scroll {autoScrollEnabled ? "ON" : "OFF"}
                </Button>
                <Button
                  type="button"
                  variant={highlighterEnabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setHighlighterEnabled((value) => !value)}
                >
                  <Type className="mr-2 h-4 w-4" />Highlight {highlighterEnabled ? "ON" : "OFF"}
                </Button>
              </>
              )}
            </>
            <div className="rounded-xl bg-white/15 px-5 py-3 text-center backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Time left</p>
              <p className="font-mono text-3xl font-bold"><Clock3 className="mr-2 inline h-6 w-6" />{formatTime}</p>
            </div>
          </div>
        </div>

        {result ? (
          <Card className="mx-auto w-full max-w-2xl border-amber-200 shadow-xl">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
              <h2 className="text-2xl font-bold">Paper submitted</h2>
              <p className="mt-2 text-muted-foreground">Your High Court marks are now included in this exam folder.</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-left">
                <div className="rounded-xl bg-red-50 p-4"><p className="text-xs font-semibold text-red-700">Full mistakes</p><p className="mt-1 text-2xl font-bold">{result.mistakes}</p></div>
                <div className="rounded-xl bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">Half mistakes</p><p className="mt-1 text-2xl font-bold">{result.halfMistakes}</p></div>
                <div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-700">Marks obtained</p><p className="mt-1 text-2xl font-bold">{result.marks}</p></div>
              </div>
              <Link href="/student?tab=results"><Button className="mt-7 bg-amber-600 hover:bg-amber-700">View High Court result</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className={expectedType !== "pitman"
             ? "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
             : "grid min-h-0 flex-1 gap-3 overflow-hidden sm:grid-cols-2"}
          >
            {expectedType === "shorthand" && (
              <Card className="shrink-0 overflow-hidden border-orange-200 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-orange-50 py-4">
                  <CardTitle className="text-sm uppercase tracking-wide text-orange-800">Dictation</CardTitle>
                  {test.youtubeLink ? (
                    <a
                      href={test.youtubeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 hover:text-red-800"
                    >
                      <Youtube className="h-4 w-4" />
                      Open Dictation
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-orange-700">Dictation link unavailable</span>
                  )}
                </CardHeader>
              </Card>
            )}

            {expectedType !== "shorthand" && (
            <Card className={`flex min-h-0 flex-col overflow-hidden border-slate-200 shadow-md ${expectedType === "typing" ? "h-[44%] shrink-0" : ""}`}>
                <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b bg-slate-50 py-3">
                  <CardTitle className="text-sm uppercase tracking-wide text-slate-600">Question paper</CardTitle>
                  {expectedType === "pitman" && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPdfZoom((value) => Math.max(50, value - 10))}
                        disabled={pdfZoom <= 50}
                        className="h-8 w-8 p-0"
                        aria-label="Zoom out PDF"
                      >
                        <ZoomOut size={16} />
                      </Button>
                      <span className="min-w-[40px] text-center text-xs font-medium">{pdfZoom}%</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPdfZoom((value) => Math.min(200, value + 10))}
                        disabled={pdfZoom >= 200}
                        className="h-8 w-8 p-0"
                        aria-label="Zoom in PDF"
                      >
                        <ZoomIn size={16} />
                      </Button>
                    </div>
                  )}
                </CardHeader>
              <CardContent
                className={`min-h-0 flex-1 bg-white p-4 dark:bg-zinc-900 ${
                  expectedType === "pitman" ? "overflow-hidden" : "overflow-auto"
                }`}
                id="high-court-question-paper"
                ref={questionPaperRef}
              >
                {expectedType === "pitman" && pdfUrl ? (
                  <HighCourtPdfViewer source={pdfUrl} zoom={pdfZoom} />
                ) : expectedType === "pitman" ? (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-slate-500">
                    <AlertCircle className="mb-3 h-10 w-10" />
                    <p className="font-semibold">{pdfError === "Loading PDF…" ? "Loading PDF…" : "PDF unavailable"}</p>
                    <p className="mt-1 text-sm">{pdfError || "The PDF could not be loaded."}</p>
                  </div>
                ) : expectedType === "typing" ? (
                  renderTypingQuestion()
                ) : (
                  <article className="prose max-w-none whitespace-pre-wrap leading-8 text-slate-800" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: test.text }} />
                )}
              </CardContent>
            </Card>
            )}

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-slate-200 shadow-md">
              <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b bg-slate-50 py-3">
                <CardTitle className="text-sm uppercase tracking-wide text-slate-600">Your response</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                {expectedType === "typing" ? (
                  <RichTextEditor
                    value={typedText}
                    onChange={updateTypingResponse}
                    onPaste={(event) => event.preventDefault()}
                    placeholder={active ? "Start typing your response here…" : "Click Start Test to begin"}
                    disabled={!active}
                    editorId="high-court-rich-editor"
                    fillHeight
                    showWordCount
                   fontSize={fontSize}
                   onFontSizeChange={setFontSize}
                  />
                ) : (
                  <Textarea
                    id="high-court-textarea"
                    value={typedText}
                    onChange={(event) => setTypedText(event.target.value)}
                    onPaste={(event) => event.preventDefault()}
                    disabled={!active}
                    placeholder={active ? "Start typing your response here…" : "Click Start Test to begin"}
                    className="min-h-0 flex-1 resize-none rounded-none border-0 p-6 leading-8 focus-visible:ring-0"
                    style={{ fontSize: `${fontSize}px` }}
                  />
                )}
                <div className="flex shrink-0 justify-end gap-3 border-t bg-slate-50 p-3">
                  {!active ? <Button onClick={start} className={`bg-gradient-to-r ${colors[expectedType]}`}>Start Test</Button> : (
                    <Button onClick={() => void submit()} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Submit paper
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}