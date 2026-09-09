import { useEffect, useState } from "react";
import { Award, Edit, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { highCourtApi, HIGH_COURT_PAPERS, type HighCourtTestSet, type HighCourtTestType } from "@/lib/highCourt";
import { PaperFields, type PaperForm } from "./HighCourtAdminForm";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type EditPapers = Record<HighCourtTestType, PaperForm>;

function toPaperForm(test?: { title: string; text: string; duration: number; pdfFile?: string | null; youtubeLink?: string | null }): PaperForm {
  return {
    title: test?.title ?? "",
    text: test?.text ?? "",
    duration: String(test?.duration ?? 5),
    pdfFile: test?.pdfFile ?? undefined,
    youtubeLink: test?.youtubeLink ?? undefined,
  };
}

export function HighCourtManageTests() {
  const { toast } = useToast();
  const [sets, setSets] = useState<HighCourtTestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [editingSet, setEditingSet] = useState<HighCourtTestSet | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDateFor, setEditDateFor] = useState("");
  const [editPapers, setEditPapers] = useState<EditPapers | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSets = async (offset = 0, append = false) => {
    try {
      const page = await highCourtApi.getTestSets({ limit: 50, offset });
      setSets((current) => append ? [...current, ...page.items] : page.items);
      setHasMore(page.hasMore);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load High Court exam folders." });
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSets().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchSets(0, false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchSets(sets.length, true);
    setLoadingMore(false);
  };

  const openEdit = async (set: HighCourtTestSet) => {
    setEditingSet(set);
    setEditTitle(set.title);
    setEditDateFor(set.dateFor);
    setEditPapers(null);
    try {
      const tests = await Promise.all(
        HIGH_COURT_PAPERS.map(async (paper) => {
          const summary = set.tests.find((test) => test.type === paper.type);
          return summary ? highCourtApi.getTest(summary.id) : null;
        })
      );
      setEditPapers({
        typing: toPaperForm(tests[0] ?? undefined),
        pitman: toPaperForm(tests[1] ?? undefined),
        shorthand: toPaperForm(tests[2] ?? undefined),
      });
    } catch (error) {
      setEditingSet(null);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load the selected High Court papers.",
      });
    }
  };

  const saveEdit = async () => {
    if (!editingSet || !editPapers) return;
    setSaving(true);
    try {
      if (editTitle !== editingSet.title) {
        await highCourtApi.updateTestSet(editingSet.id, { name: editTitle, dateFor: editDateFor });
      } else if (editDateFor !== editingSet.dateFor) {
        await highCourtApi.updateTestSet(editingSet.id, { dateFor: editDateFor });
      }
      await Promise.all(
        HIGH_COURT_PAPERS.map((paper) => {
          const test = editingSet.tests.find((t) => t.type === paper.type);
          const form = editPapers[paper.type];
          if (!test) return Promise.resolve(undefined);
          return highCourtApi.updateTest(test.id, {
            title: form.title,
            originalText: form.text,
            duration: Number(form.duration),
            pdfFile: form.pdfFile,
            youtubeLink: paper.type === "shorthand" ? (form.youtubeLink?.trim() || null) : undefined,
          });
        })
      );
      toast({ title: "Saved", description: "High Court exam folder updated." });
      setEditingSet(null);
      setEditPapers(null);
      await fetchSets(0, false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (set: HighCourtTestSet) => {
    const nextEnabled = !set.isEnabled;
    setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, isEnabled: nextEnabled } : s)));
    try {
      await highCourtApi.updateTestSet(set.id, { isEnabled: nextEnabled });
    } catch (error) {
      setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, isEnabled: set.isEnabled } : s)));
      toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
    }
  };

  const deleteSet = async (set: HighCourtTestSet) => {
    if (!window.confirm(`Delete "${set.title}"? This removes all three papers and any student attempts for this folder.`)) {
      return;
    }
    setDeletingId(set.id);
    try {
      await highCourtApi.deleteTestSet(set.id);
      setSets((prev) => prev.filter((s) => s.id !== set.id));
      toast({ title: "Deleted", description: "High Court exam folder removed." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete exam folder." });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSets = sets.filter((set) => set.title.toLowerCase().includes(search.toLowerCase()));
  const activeCount = sets.filter((set) => set.isEnabled).length;

  return (
    <Card className="shadow-lg border-0 overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Award className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-lg">High Court Tests</CardTitle>
              <CardDescription>{sets.length} exam folders, {activeCount} active</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search exam folders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-44 sm:w-56 bg-white"
                data-testid="input-search-high-court-tests"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={refreshing}
              onClick={refresh}
              data-testid="button-refresh-high-court-tests"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading High Court exam folders...
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Exam Folder</TableHead>
                  <TableHead className="font-semibold">Papers</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSets.map((set) => (
                  <TableRow key={set.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm">
                      {format(new Date(`${set.dateFor}T00:00:00`), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">{set.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {HIGH_COURT_PAPERS.map((paper) => {
                          const test = set.tests.find((t) => t.type === paper.type);
                          return (
                            <span key={paper.type} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {paper.label}{test ? ` · ${test.duration}m` : " · missing"}
                            </span>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {set.isEnabled ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog
                          open={editingSet?.id === set.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setEditingSet(null);
                              setEditPapers(null);
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                              onClick={() => openEdit(set)}
                              title="Edit exam folder"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit High Court Exam Folder</DialogTitle>
                            </DialogHeader>
                             {!editPapers && editingSet && (
                               <div className="flex items-center justify-center p-10 text-muted-foreground">
                                 <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading paper details…
                               </div>
                             )}
                             {editPapers && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Exam folder name</Label>
                                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                  <Label>Schedule date</Label>
                                  <Input type="date" value={editDateFor} onChange={(e) => setEditDateFor(e.target.value)} />
                                </div>
                                <PaperFields
                                  label="Typing Test · 100 Marks"
                                  paper={editPapers.typing}
                                  onChange={(changes) =>
                                    setEditPapers((prev) => (prev ? { ...prev, typing: { ...prev.typing, ...changes } } : prev))
                                  }
                                />
                                <PaperFields
                                  label="Pitman Test · 100 Marks"
                                  paper={editPapers.pitman}
                                  onChange={(changes) =>
                                    setEditPapers((prev) => (prev ? { ...prev, pitman: { ...prev.pitman, ...changes } } : prev))
                                  }
                                  pitman
                                  pdfUrl={editingSet?.tests.find((test) => test.type === "pitman")?.id
                                    ? `/api/high-court/tests/${editingSet?.tests.find((test) => test.type === "pitman")?.id}/pdf`
                                    : undefined}
                                />
                                <PaperFields
                                  label="Shorthand Test · 200 Marks"
                                  paper={editPapers.shorthand}
                                  onChange={(changes) =>
                                    setEditPapers((prev) => (prev ? { ...prev, shorthand: { ...prev.shorthand, ...changes } } : prev))
                                  }
                                  shorthand
                                />
                                <div className="flex justify-end gap-2 pt-2">
                                  <Button variant="outline" onClick={() => setEditingSet(null)}>Cancel</Button>
                                  <Button onClick={saveEdit} disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Changes
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Switch checked={set.isEnabled} onCheckedChange={() => toggleEnabled(set)} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-red-50"
                          onClick={() => deleteSet(set)}
                          disabled={deletingId === set.id}
                        >
                          {deletingId === set.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      No High Court exam folders yet
                    </TableCell>
                  </TableRow>
                )}
               </TableBody>
            </Table>
          </div>
        )}
         {!loading && hasMore && (
           <div className="flex justify-center border-t p-4">
             <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
               {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {loadingMore ? "Loading…" : "Load more"}
             </Button>
           </div>
         )}
      </CardContent>
    </Card>
  );
}
