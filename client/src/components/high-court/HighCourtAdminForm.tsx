import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, ClipboardPenLine, FileText, Loader2, Upload, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";
import { highCourtApi, type HighCourtTestType } from "@/lib/highCourt";
import { useToast } from "@/hooks/use-toast";

export type PaperForm = { title: string; text: string; duration: string; pdfFile?: string; youtubeLink?: string };

const initialPaper = (label: string): PaperForm => ({ title: label, text: "", duration: "5" });
const today = () => new Date().toISOString().slice(0, 10);

export function PaperFields({
  label,
  paper,
  onChange,
  pitman,
  shorthand,
  pdfUrl,
}: {
  label: string;
  paper: PaperForm;
  onChange: (changes: Partial<PaperForm>) => void;
  pitman?: boolean;
  shorthand?: boolean;
  pdfUrl?: string;
}) {
  const uploadPdf = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ pdfFile: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>Included when this paper is selected for the High Court exam folder.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div className="space-y-2">
            <Label>Test Title</Label>
            <Input value={paper.title} onChange={(e) => onChange({ title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Duration {shorthand ? "(2-90 min)" : "(2-60 min)"}</Label>
            <Input type="number" min="1" max="180" value={paper.duration} onChange={(e) => onChange({ duration: e.target.value })} required />
          </div>
        </div>
        {pitman && (
          <div className="space-y-2">
            <Label>Upload PDF File</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => uploadPdf(e.target.files?.[0])} />
            {paper.pdfFile && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <p className="font-medium text-emerald-700">PDF attached and ready to upload.</p>
                <a
                  href={pdfUrl || paper.pdfFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-purple-700 underline underline-offset-2 hover:text-purple-900"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View attached PDF
                </a>
              </div>
            )}
          </div>
        )}
        {shorthand && (
          <div className="space-y-2">
            <Label htmlFor={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-youtube-link`}>
              YouTube Practice Link <span className="font-normal text-muted-foreground">(Optional)</span>
            </Label>
            <div className="relative">
              <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-600" />
              <Input
                id={`${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-youtube-link`}
                type="url"
                value={paper.youtubeLink || ""}
                onChange={(e) => onChange({ youtubeLink: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">Students can open this dictation from the High Court Shorthand test.</p>
          </div>
        )}
        <RichTextEditor
          label="Content Text (Transcript)"
          value={paper.text}
          onChange={(text) => onChange({ text })}
          placeholder="Paste the text content here..."
          showWordCount
        />
      </CardContent>
    </Card>
  );
}

export function HighCourtAdminForm() {
  const { toast } = useToast();
  const [setTitle, setSetTitle] = useState("");
  const [dateFor, setDateFor] = useState(today);
  const [typing, setTyping] = useState<PaperForm>(() => initialPaper("Typing Paper"));
  const [pitman, setPitman] = useState<PaperForm>(() => initialPaper("Pitman Paper"));
  const [shorthand, setShorthand] = useState<PaperForm>(() => initialPaper("Shorthand Paper"));
  const [selectedPaperTypes, setSelectedPaperTypes] = useState<HighCourtTestType[]>(["typing"]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedPaperTypes.length === 0) {
      toast({
        variant: "destructive",
        title: "Select at least one paper",
        description: "Choose the High Court paper you want to upload now. You can add the other papers later.",
      });
      return;
    }
    const papers: Record<HighCourtTestType, PaperForm> = { typing, pitman, shorthand };
    const incompleteType = selectedPaperTypes.find((type) => {
      const paper = papers[type];
      return !paper.title.trim() || !paper.text.trim() || !Number.isFinite(Number(paper.duration)) || Number(paper.duration) <= 0;
    });
    if (incompleteType) {
      toast({
        variant: "destructive",
        title: "Complete the selected paper",
        description: "Enter a title, content, and valid duration for every selected paper.",
      });
      return;
    }
    if (selectedPaperTypes.includes("pitman") && !pitman.pdfFile) {
      toast({
        variant: "destructive",
        title: "Pitman PDF required",
        description: "Upload the Pitman question-paper PDF when adding the Pitman paper.",
      });
      return;
    }
    setSaving(true);
    try {
      const tests = selectedPaperTypes.map((type) => {
        const paper = papers[type];
        return {
          type,
          title: paper.title,
          text: paper.text,
          duration: Number(paper.duration),
          ...(type === "pitman" && paper.pdfFile ? { pdfFile: paper.pdfFile } : {}),
          ...(type === "shorthand" && paper.youtubeLink?.trim() ? { youtubeLink: paper.youtubeLink.trim() } : {}),
        };
      });
      await highCourtApi.createTestSet({
        title: setTitle,
        dateFor,
        tests,
      });
      setCreated(setTitle);
      setSetTitle("");
      setDateFor(today());
      setTyping(initialPaper("Typing Paper"));
      setPitman(initialPaper("Pitman Paper"));
      setShorthand(initialPaper("Shorthand Paper"));
      setSelectedPaperTypes(["typing"]);
      toast({ title: "High Court folder published", description: "The selected paper is now available in the exam folder. Add other papers later from Manage Tests." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not publish folder", description: error instanceof Error ? error.message : "Please review the papers and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white shadow-lg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Admin dashboard · High Court</p>
          <h2 className="text-2xl font-bold">Create High Court Assessment</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/85">Start an exam folder with any paper, then add the remaining papers later from Manage Tests.</p>
        </div>
        <Link href="/student?tab=high-court_tests">
          <Button variant="secondary">Preview student area</Button>
        </Link>
      </div>

      {created && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <span><strong>{created}</strong> was published with the selected High Court papers.</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Card className="border-amber-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardPenLine className="h-5 w-5 text-amber-700" /> Exam folder</CardTitle>
          <CardDescription>Use a clear name such as “High Court Main Examination – Set 01”. Papers can be added to this folder over time.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="high-court-folder-name">Exam folder name</Label>
              <Input id="high-court-folder-name" value={setTitle} onChange={(e) => setSetTitle(e.target.value)} placeholder="High Court Main Examination – Set 01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="high-court-date">Schedule date</Label>
              <Input id="high-court-date" type="date" value={dateFor} onChange={(e) => setDateFor(e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pt-2">
          <FileText className="h-5 w-5 text-amber-700" />
          <div>
            <h3 className="font-bold">Choose papers to upload</h3>
            <p className="text-sm text-muted-foreground">Select one or more papers now. You can add the others later.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["typing", "Typing Test · 100 Marks"],
            ["pitman", "Pitman Test · 100 Marks"],
            ["shorthand", "Shorthand Test · 200 Marks"],
          ] as Array<[HighCourtTestType, string]>).map(([type, label]) => (
            <label key={type} className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3 text-sm shadow-sm">
              <input
                type="checkbox"
                checked={selectedPaperTypes.includes(type)}
                onChange={(event) => {
                  setSelectedPaperTypes((current) =>
                    event.target.checked ? [...current, type] : current.filter((item) => item !== type),
                  );
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {selectedPaperTypes.includes("typing") && (
          <PaperFields label="Typing Test · 100 Marks" paper={typing} onChange={(changes) => setTyping((current) => ({ ...current, ...changes }))} />
        )}
        {selectedPaperTypes.includes("pitman") && (
          <PaperFields label="Pitman Test · 100 Marks" paper={pitman} onChange={(changes) => setPitman((current) => ({ ...current, ...changes }))} pitman />
        )}
        {selectedPaperTypes.includes("shorthand") && (
          <PaperFields label="Shorthand Test · 200 Marks" paper={shorthand} onChange={(changes) => setShorthand((current) => ({ ...current, ...changes }))} shorthand />
        )}

        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-muted-foreground">You can add more papers later from Manage Tests.</p>
          <Button type="submit" size="lg" disabled={saving} className="bg-gradient-to-r from-amber-600 to-orange-600">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
            Publish selected papers
          </Button>
        </div>
      </form>
    </div>
  );
}