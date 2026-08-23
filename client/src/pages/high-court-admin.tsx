import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ClipboardPenLine, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { highCourtApi } from "@/lib/highCourt";
import { useToast } from "@/hooks/use-toast";

type PaperForm = { title: string; text: string; duration: string; pdfFile?: string };

const initialPaper = (label: string): PaperForm => ({ title: label, text: "", duration: "5" });

function PaperFields({
  label,
  paper,
  onChange,
  pitman,
}: {
  label: string;
  paper: PaperForm;
  onChange: (changes: Partial<PaperForm>) => void;
  pitman?: boolean;
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
        <CardDescription>Required for this High Court exam folder.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <div className="space-y-2">
            <Label>Paper title</Label>
            <Input value={paper.title} onChange={(e) => onChange({ title: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input type="number" min="1" max="180" value={paper.duration} onChange={(e) => onChange({ duration: e.target.value })} required />
          </div>
        </div>
        {pitman && (
          <div className="space-y-2">
            <Label>Optional Pitman reference PDF</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => uploadPdf(e.target.files?.[0])} />
            {paper.pdfFile && <p className="text-xs font-medium text-emerald-700">PDF attached and ready to upload.</p>}
          </div>
        )}
        <div className="space-y-2">
          <Label>Question paper text</Label>
          <Textarea
            value={paper.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Paste or type the complete English paper here. HTML is supported for Typing formatting."
            className="min-h-40"
            required
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function HighCourtAdminPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [setTitle, setSetTitle] = useState("");
  const [typing, setTyping] = useState<PaperForm>(() => initialPaper("Typing Paper"));
  const [pitman, setPitman] = useState<PaperForm>(() => initialPaper("Pitman Paper"));
  const [shorthand, setShorthand] = useState<PaperForm>(() => initialPaper("Shorthand Paper"));
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await highCourtApi.createTestSet({
        title: setTitle,
        typing: { title: typing.title, text: typing.text, duration: Number(typing.duration) },
        pitman: { title: pitman.title, text: pitman.text, duration: Number(pitman.duration), pdfFile: pitman.pdfFile },
        shorthand: { title: shorthand.title, text: shorthand.text, duration: Number(shorthand.duration) },
      });
      setCreated(setTitle);
      setSetTitle("");
      setTyping(initialPaper("Typing Paper"));
      setPitman(initialPaper("Pitman Paper"));
      setShorthand(initialPaper("Shorthand Paper"));
      toast({ title: "High Court folder published", description: "All three papers are now available to students together." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not publish folder", description: error instanceof Error ? error.message : "Please review the papers and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white shadow-lg">
        <div className="flex gap-3">
          <Button variant="secondary" size="icon" onClick={() => setLocation("/admin")} aria-label="Back to dashboard"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Dedicated administration area</p>
            <h1 className="text-2xl font-bold">High Court Assessment Upload</h1>
            <p className="mt-1 text-sm text-white/85">Create one exam folder and publish all three required papers at once.</p>
          </div>
        </div>
        <Link href="/student?tab=high-court_tests"><Button variant="secondary">Preview student area</Button></Link>
      </div>

      {created && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /><span><strong>{created}</strong> was published with Typing, Pitman, and Shorthand papers.</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <Card className="border-amber-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardPenLine className="h-5 w-5 text-amber-700" /> Step 1 — Exam folder</CardTitle>
            <CardDescription>The folder is the shared identifier that combines a student's three High Court scores.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Exam folder name</Label>
            <Input value={setTitle} onChange={(e) => setSetTitle(e.target.value)} placeholder="Example: High Court Main Examination – Set 01" required />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 pt-2"><FileText className="h-5 w-5 text-amber-700" /><h2 className="font-bold">Step 2 — Upload all three papers</h2></div>
        <PaperFields label="Typing Test · 100 Marks" paper={typing} onChange={(changes) => setTyping((current) => ({ ...current, ...changes }))} />
        <PaperFields label="Pitman Test · 100 Marks" paper={pitman} onChange={(changes) => setPitman((current) => ({ ...current, ...changes }))} pitman />
        <PaperFields label="Shorthand Test · 200 Marks" paper={shorthand} onChange={(changes) => setShorthand((current) => ({ ...current, ...changes }))} />

        <div className="sticky bottom-4 flex justify-end rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur">
          <Button type="submit" size="lg" disabled={saving} className="bg-gradient-to-r from-amber-600 to-orange-600">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Upload className="mr-2 h-5 w-5" />}
            Publish all three High Court papers
          </Button>
        </div>
      </form>
    </div>
  );
}