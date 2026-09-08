import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Award, CalendarDays, ChevronLeft, Download, Eye, FileText, Loader2, PenLine, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { highCourtApi, HIGH_COURT_PAPERS, type HighCourtGroupedResult, type HighCourtTestSet, type HighCourtTestType } from "@/lib/highCourt";
import { HighCourtErrorComparison } from "./HighCourtErrorComparison";
import { downloadHighCourtPdf } from "@/lib/highCourtPdf";

const papers = HIGH_COURT_PAPERS;

const routeFor = (type: HighCourtTestType, id: number) => `/high-court/${type}/${id}`;

export function HighCourtStudentArea() {
  const [sets, setSets] = useState<HighCourtTestSet[]>([]);
  const [selected, setSelected] = useState<HighCourtTestSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    highCourtApi.getTestSets()
      .then(setSets)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load High Court folders."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-16"><Loader2 className="h-7 w-7 animate-spin text-amber-600" /></div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;

  if (selected) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setSelected(null)} aria-label="All High Court folders"><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">High Court examination folder</p>
            <h2 className="text-xl font-bold text-slate-900">{selected.title}</h2>
            <p className="text-sm text-slate-500">Choose one paper. All three scores combine into a 400-mark High Court result.</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {papers.map((paper) => {
            const test = selected.tests.find((item) => item.type === paper.type);
            return (
              <Card key={paper.type} className="overflow-hidden border-slate-200 shadow-sm transition-shadow hover:shadow-lg">
                <div className={`h-2 bg-gradient-to-r ${paper.color}`} />
                <CardHeader>
                  <CardTitle>{paper.label} Test</CardTitle>
                  <CardDescription>{test?.duration ?? "—"} minutes · {paper.max} marks</CardDescription>
                </CardHeader>
                <CardContent className="min-h-24">
                  <p className="text-sm text-slate-600">
                    {paper.type === "typing" ? "Full mistakes deduct 0.20 marks." : paper.type === "pitman" ? "Full mistakes deduct 0.40 marks." : "Full mistakes deduct 0.40; half mistakes deduct 0.20."}
                  </p>
                </CardContent>
                <CardFooter>
                  {test ? (
                    <Link href={routeFor(paper.type, test.id)} className="w-full">
                      <Button
                        className={`w-full bg-gradient-to-r ${paper.color}`}
                        data-testid={`button-start-high-court-${paper.type}`}
                        aria-label={`Start High Court ${paper.label} Test`}
                      >
                        <PenLine className="mr-2 h-4 w-4" /> Start {paper.label} Test
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">Unavailable</Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-100 p-3"><Award className="h-6 w-6 text-amber-700" /></div>
        <div><h2 className="text-xl font-bold text-slate-900">High Court Assessments</h2><p className="text-sm text-slate-500">Select an English exam folder, then complete Typing, Pitman, and Shorthand.</p></div>
      </div>
      {!sets.length ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center text-slate-500"><FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />No High Court exam folders have been published yet.</CardContent></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((set) => <Card key={set.id} className="group border-amber-100 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardHeader><div className="mb-3 flex items-center justify-between"><div className="rounded-lg bg-amber-100 p-2"><Award className="h-5 w-5 text-amber-700" /></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">English</span></div><CardTitle className="leading-snug">{set.title}</CardTitle><CardDescription className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${set.dateFor}T00:00:00`).toLocaleDateString()}</CardDescription></CardHeader>
            <CardContent><div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600"><span className="rounded bg-blue-50 p-2">Typing<br /><b>100</b></span><span className="rounded bg-rose-50 p-2">Pitman<br /><b>100</b></span><span className="rounded bg-orange-50 p-2">Shorthand<br /><b>200</b></span></div></CardContent>
            <CardFooter><Button onClick={() => highCourtApi.getTestSet(set.id).then(setSelected).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to open this folder."))} className="w-full bg-amber-600 hover:bg-amber-700">Open folder</Button></CardFooter>
          </Card>)}
        </div>
      )}
    </section>
  );
}

export function HighCourtResultsPanel() {
  const [results, setResults] = useState<HighCourtGroupedResult[]>([]);
  const [selected, setSelected] = useState<HighCourtGroupedResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    highCourtApi.getMyResults().then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>;
  if (!results.length) return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No High Court paper has been submitted yet.</div>;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-amber-50 text-left text-amber-900"><tr><th className="p-4">Exam folder</th><th className="p-4">Student Name</th><th className="p-4 text-center">Typing</th><th className="p-4 text-center">Pitman</th><th className="p-4 text-center">Shorthand</th><th className="p-4 text-center">Total</th><th className="p-4 text-right">Action</th></tr></thead>
          <tbody>{results.map((result) => <tr key={result.testSetId} className="border-t hover:bg-slate-50"><td className="p-4 font-semibold">{result.testSetTitle}</td><td className="p-4">{result.studentName}</td><td className="p-4 text-center">{result.typingMarks} / 100</td><td className="p-4 text-center">{result.pitmanMarks} / 100</td><td className="p-4 text-center">{result.shorthandMarks} / 200</td><td className="p-4 text-center font-bold text-amber-800">{result.totalMarks} / 400</td><td className="p-4 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setSelected(result)}><Eye className="mr-1.5 h-4 w-4" /> View</Button><Button size="sm" variant="outline" onClick={() => downloadHighCourtPdf(result)} data-testid={`button-download-high-court-pdf-${result.testSetId}`}><Download className="mr-1.5 h-4 w-4" /> PDF</Button></div></td></tr>)}</tbody>
        </table>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="w-[calc(100%-1rem)] max-h-[88vh] max-w-4xl overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-600" />{selected?.testSetTitle} — High Court Report</DialogTitle></DialogHeader>
          {selected && <div className="min-w-0 space-y-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4"><div className="min-w-0"><p className="text-sm text-amber-800">Combined total</p><p className="text-3xl font-bold text-amber-900">{selected.totalMarks} <span className="text-base">/ 400</span></p></div><Button className="shrink-0 bg-amber-600 hover:bg-amber-700" onClick={() => downloadHighCourtPdf(selected)}><Download className="mr-2 h-4 w-4" />Download</Button></div>
            {papers.map((paper) => {
              const attempt = selected[paper.type];
                return <Card key={paper.type} className="min-w-0 overflow-hidden"><CardHeader className="pb-3"><CardTitle className="flex min-w-0 items-center justify-between gap-3 text-base"><span className="min-w-0">{paper.label} Test</span><span className="shrink-0 text-amber-800">{attempt?.marks ?? 0} / {paper.max}</span></CardTitle><CardDescription className="break-words">{attempt ? `Submitted ${new Date(attempt.submittedAt).toLocaleString()} · ${attempt.mistakes} full / ${attempt.halfMistakes} half mistakes` : "Not submitted yet"}</CardDescription></CardHeader>{attempt && <CardContent className="min-w-0"><HighCourtErrorComparison alignment={attempt.alignment} /></CardContent>}</Card>;
            })}
          </div>}
        </DialogContent>
      </Dialog>
    </>
  );
}