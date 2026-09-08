import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowDown, ArrowLeft, CheckCircle2, Clock3, Loader2, Maximize, Minimize, Save, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RichTextEditor } from "@/components/RichTextEditor";
import { highCourtApi, type HighCourtTest, type HighCourtTestType } from "@/lib/highCourt";
import { stripHtmlEntities, stripHtmlPreserveParagraphs, PARA_TOKEN } from "@/lib/utils";
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const [test, setTest] = useState<HighCourtTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [active, setActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [highlighterEnabled, setHighlighterEnabled] = useState(true);
  const [result, setResult] = useState<{ mistakes: string | number; halfMistakes: string | number; marks: string | number } | null>(null);

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
    if (expectedType !== "pitman" || !test?.pdfFile) {
      setPdfUrl("");
      setPdfError(expectedType === "pitman" && test ? "No PDF has been uploaded for this paper." : "");
      return;
    }

    let objectUrl = "";
    try {
      const base64 = test.pdfFile.includes(",") ? test.pdfFile.split(",")[1] : test.pdfFile;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      setPdfUrl(objectUrl);
      setPdfError("");
    } catch (error) {
      console.error("Unable to prepare High Court Pitman PDF:", error);
      setPdfUrl("");
      setPdfError("The PDF could not be opened. Please ask the administrator to upload it again.");
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [expectedType, test]);

  const submit = useCallback(async () => {
    if (!test || submittedRef.current) return;
    submittedRef.current = true;
    setActive(false);
    setSubmitting(true);
    try {
      const saved = await highCourtApi.submitAttempt({
        testSetId: test.testSetId,
        testId: test.id,
        typedText,
      });
      setResult({ mistakes: saved.mistakes, halfMistakes: saved.halfMistakes, marks: saved.marks });
      toast({ title: "High Court test submitted", description: "Your marks were calculated and saved." });
    } catch (error) {
      submittedRef.current = false;
      toast({ variant: "destructive", title: "Submission failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }, [expectedType, test, toast, typedText]);

  useEffect(() => {
    if (!active) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((seconds) => {
        if (seconds <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          void submit();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, submit]);

  const start = () => {
    setActive(true);
    setTimeout(() => document.getElementById(expectedType === "typing" ? "high-court-rich-editor" : "high-court-textarea")?.focus(), 0);
  };

  const updateTypingResponse = (html: string) => {
    setTypedText(html);
    if (!autoScrollEnabled || !test) return;
    const question = document.getElementById("high-court-question-paper");
    if (!question) return;
    const typedWords = html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const totalWords = test.text.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const ratio = Math.min(1, typedWords / Math.max(1, totalWords));
    question.scrollTop = ratio * Math.max(0, question.scrollHeight - question.clientHeight);
  };

  const getHighlightedTypingContent = () => {
    if (!test || !highlighterEnabled) return test?.text || "";

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
    const highlightStyle = "background-color: #fbbf24; padding: 2px 4px; border-radius: 2px; font-weight: 500;";

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
    <article
      className="prose max-w-none whitespace-pre-wrap leading-8 text-slate-800"
      style={{ fontSize }}
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
    <div className={isFullScreen ? "fixed inset-0 z-[60] overflow-auto bg-slate-100 p-4 md:p-6" : "min-h-full bg-slate-100 p-4 md:p-6"}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r ${colors[expectedType]} p-5 text-white shadow-lg`}>
          <div className="flex items-center gap-3">
            <Link href="/student?tab=high-court_tests"><Button variant="secondary" size="icon" aria-label="Back to High Court"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/70">High Court Assessment</p>
              <h1 className="text-xl font-bold">{test.title}</h1>
              <p className="text-sm text-white/80">{labels[expectedType]} · {test.duration} minutes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="secondary" size="icon" onClick={() => setIsFullScreen((value) => !value)} title="Toggle full screen">
              {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            {expectedType === "typing" && (
              <>
                <div className="hidden items-center gap-2 rounded-lg bg-white/15 px-3 py-2 md:flex">
                  <Type className="h-4 w-4" />
                  <Slider value={[fontSize]} onValueChange={(value) => setFontSize(value[0])} min={12} max={32} step={2} className="w-24" />
                  <span className="w-8 text-xs">{fontSize}px</span>
                </div>
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
          <div className="grid min-h-[620px] gap-4 lg:grid-cols-2">
            <Card className="flex min-h-[430px] flex-col overflow-hidden border-slate-200 shadow-md">
              <CardHeader className="border-b bg-slate-50 py-4"><CardTitle className="text-sm uppercase tracking-wide text-slate-600">Question paper</CardTitle></CardHeader>
              <CardContent className="flex-1 overflow-auto p-6" id="high-court-question-paper">
                {expectedType === "pitman" && pdfUrl ? (
                  <iframe title="High Court Pitman paper" className="h-full min-h-[500px] w-full rounded border" src={pdfUrl} />
                ) : expectedType === "pitman" ? (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center text-slate-500">
                    <AlertCircle className="mb-3 h-10 w-10" />
                    <p className="font-semibold">PDF unavailable</p>
                    <p className="mt-1 text-sm">{pdfError || "The PDF could not be loaded."}</p>
                  </div>
                ) : expectedType === "typing" ? (
                  renderTypingQuestion()
                ) : (
                  <article className="prose max-w-none whitespace-pre-wrap leading-8 text-slate-800" style={{ fontSize }} dangerouslySetInnerHTML={{ __html: test.text }} />
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[430px] flex-col overflow-hidden border-slate-200 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50 py-4">
                <CardTitle className="text-sm uppercase tracking-wide text-slate-600">Your response</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-0">
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
                    className="min-h-[390px]"
                  />
                ) : (
                  <Textarea
                    id="high-court-textarea"
                    value={typedText}
                    onChange={(event) => setTypedText(event.target.value)}
                    onPaste={(event) => event.preventDefault()}
                    disabled={!active}
                    placeholder={active ? "Start typing your response here…" : "Click Start Test to begin"}
                    className="min-h-[390px] flex-1 resize-none rounded-none border-0 p-6 text-lg leading-8 focus-visible:ring-0"
                  />
                )}
                <div className="flex justify-end gap-3 border-t bg-slate-50 p-4">
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