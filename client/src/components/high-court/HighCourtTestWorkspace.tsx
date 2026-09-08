import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Italic, Bold, Underline, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { highCourtApi, type HighCourtTest, type HighCourtTestType } from "@/lib/highCourt";
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
  const editorRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const [test, setTest] = useState<HighCourtTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [active, setActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const submit = useCallback(async () => {
    if (!test || submittedRef.current) return;
    submittedRef.current = true;
    setActive(false);
    setSubmitting(true);
    try {
      const saved = await highCourtApi.submitAttempt({
        testSetId: test.testSetId,
        testId: test.id,
        typedText: expectedType === "typing" ? (editorRef.current?.innerHTML || typedText) : typedText,
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
    setTimeout(() => (expectedType === "typing" ? editorRef.current : document.getElementById("high-court-textarea"))?.focus(), 0);
  };

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
    <div className="min-h-full bg-slate-100 p-4 md:p-6">
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
          <div className="rounded-xl bg-white/15 px-5 py-3 text-center backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Time left</p>
            <p className="font-mono text-3xl font-bold"><Clock3 className="mr-2 inline h-6 w-6" />{formatTime}</p>
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
              <CardContent className="flex-1 overflow-auto p-6">
                {expectedType === "pitman" && test.pdfFile ? (
                  <iframe title="High Court Pitman paper" className="h-full min-h-[500px] w-full rounded border" src={test.pdfFile} />
                ) : (
                  <article className="prose max-w-none whitespace-pre-wrap leading-8 text-slate-800" dangerouslySetInnerHTML={{ __html: test.text }} />
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[430px] flex-col overflow-hidden border-slate-200 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50 py-4">
                <CardTitle className="text-sm uppercase tracking-wide text-slate-600">Your response</CardTitle>
                {expectedType === "typing" && (
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="icon" disabled={!active} onClick={() => document.execCommand("bold")}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" disabled={!active} onClick={() => document.execCommand("italic")}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" disabled={!active} onClick={() => document.execCommand("underline")}><Underline className="h-4 w-4" /></Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-0">
                {expectedType === "typing" ? (
                  <div
                    ref={editorRef}
                    contentEditable={active}
                    onInput={(event) => setTypedText((event.target as HTMLDivElement).innerHTML)}
                    onPaste={(event) => event.preventDefault()}
                    className="min-h-[390px] flex-1 whitespace-pre-wrap p-6 text-lg leading-8 outline-none"
                    data-placeholder={active ? "Start typing your response here…" : "Click Start Test to begin"}
                    suppressContentEditableWarning
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