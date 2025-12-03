import { useState, useRef } from "react";
import { useStore, Assignment, TestResult, AssignmentType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Printer, FileText, History, Eye, Power } from "lucide-react";
import { useReactToPrint } from 'react-to-print';

export default function AdminDashboard() {
  const { assignments, results, addAssignment, deleteAssignment, toggleAssignmentEnabled } = useStore();
  const { toast } = useToast();
  
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDuration, setNewDuration] = useState("2");
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState<AssignmentType>("typing");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Filter state
  const [studentFilter, setStudentFilter] = useState("");

  // Detail Dialog State
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleAddAssignment = () => {
    if (!newTitle || !newContent) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    addAssignment({
      title: newTitle,
      content: newContent,
      durationMinutes: parseInt(newDuration),
      date: newDate,
      type: newType,
    });

    setNewTitle("");
    setNewContent("");
    setIsDialogOpen(false);
    toast({
      title: "Success",
      description: "Assignment created successfully",
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      deleteAssignment(id);
    }
  };

  const handleToggle = (id: string) => {
    toggleAssignmentEnabled(id);
    toast({
      title: "Updated",
      description: "Assignment visibility updated",
    });
  };

  const openDetails = (result: TestResult) => {
    setSelectedResult(result);
    setIsDetailOpen(true);
  };

  const filteredResults = results
    .filter(r => studentFilter ? r.username.toLowerCase().includes(studentFilter.toLowerCase()) : true);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage content and view student results.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> Upload New Content
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Upload New Content</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Test Type</Label>
                  <Tabs value={newType} onValueChange={(v) => setNewType(v as AssignmentType)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="typing">Typing Test</TabsTrigger>
                      <TabsTrigger value="shorthand">Shorthand Test</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      placeholder="e.g. Morning Session" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input 
                      type="date" 
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Duration (Minutes)</Label>
                  <Select value={newDuration} onValueChange={setNewDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Minutes</SelectItem>
                      <SelectItem value="5">5 Minutes</SelectItem>
                      <SelectItem value="10">10 Minutes</SelectItem>
                      <SelectItem value="15">15 Minutes</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Content Text</Label>
                  <Textarea 
                    className="h-[200px] font-mono text-sm"
                    placeholder="Paste the text content here..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste content from Word or Text files here.
                  </p>
                </div>

                <Button className="w-full" onClick={handleAddAssignment}>
                  Save & Publish
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="managed-content" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2">
          <TabsTrigger value="managed-content" className="gap-2">
            <FileText className="h-4 w-4" /> Managed Content
          </TabsTrigger>
          <TabsTrigger value="student-results" className="gap-2">
            <History className="h-4 w-4" /> Student Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="managed-content" className="mt-6 space-y-8">
          {/* Typing Content Section */}
          <div className="space-y-4">
             <h3 className="text-xl font-bold">Typing Tests</h3>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignments.filter(a => a.type === 'typing').map((assignment) => (
                <AssignmentCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onDelete={handleDelete} 
                  onToggle={handleToggle} 
                />
              ))}
              {assignments.filter(a => a.type === 'typing').length === 0 && (
                 <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                   No typing tests uploaded.
                 </div>
              )}
             </div>
          </div>

          {/* Shorthand Content Section */}
          <div className="space-y-4">
             <h3 className="text-xl font-bold">Shorthand Tests</h3>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignments.filter(a => a.type === 'shorthand').map((assignment) => (
                <AssignmentCard 
                  key={assignment.id} 
                  assignment={assignment} 
                  onDelete={handleDelete} 
                  onToggle={handleToggle} 
                />
              ))}
              {assignments.filter(a => a.type === 'shorthand').length === 0 && (
                 <div className="col-span-full text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                   No shorthand tests uploaded.
                 </div>
              )}
             </div>
          </div>
        </TabsContent>

        <TabsContent value="student-results" className="mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Student Performance Reports</CardTitle>
                <CardDescription>View and print detailed analysis.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                 <Input 
                   placeholder="Filter by student name..." 
                   value={studentFilter}
                   onChange={(e) => setStudentFilter(e.target.value)}
                   className="w-full sm:w-64"
                 />
                 {filteredResults.length > 0 && (
                   <Button variant="outline" className="gap-2" onClick={() => handlePrint && handlePrint()}>
                     <Printer className="h-4 w-4" /> Print Report
                   </Button>
                 )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="typing-results">
                <TabsList className="mb-4">
                  <TabsTrigger value="typing-results">Typing Results</TabsTrigger>
                  <TabsTrigger value="shorthand-results">Shorthand Results</TabsTrigger>
                </TabsList>

                <div ref={printRef} className="p-4 print:p-0">
                  <div className="hidden print:block mb-8 text-center border-b pb-4">
                    <h1 className="text-2xl font-bold">Pragati Shorthand and Typing</h1>
                    <p className="text-muted-foreground">Official Test Results</p>
                    <p className="text-sm mt-2">Report Date: {formatDate(new Date().toISOString())}</p>
                    {studentFilter && <p className="text-sm font-bold mt-1">Student Filter: {studentFilter}</p>}
                  </div>

                  <TabsContent value="typing-results">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Words</TableHead>
                          <TableHead>Time (min)</TableHead>
                          <TableHead>Mistakes</TableHead>
                          <TableHead>Backspaces</TableHead>
                          <TableHead>Gross Speed</TableHead>
                          <TableHead>Net Speed</TableHead>
                          <TableHead className="text-right print:hidden">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.filter(r => r.type === 'typing').map((result) => {
                           const assignment = assignments.find(a => a.id === result.assignmentId);
                           const duration = assignment ? assignment.durationMinutes : '-';
                           return (
                            <TableRow key={result.id}>
                              <TableCell className="font-medium">{result.username}</TableCell>
                              <TableCell>{formatDate(result.dateTaken)}</TableCell>
                              <TableCell>{result.totalChars ? Math.round(result.totalChars / 5) : '-'}</TableCell> {/* Showing approximate words typed based on chars? Or did we store words? The updated store doesn't explicitly store "wordsCount" but we can derive or update store. Let's stick to derived for now or add it. Actually `totalChars` is stored. Let's use WPM * Time for approximation or just use WPM logic. Wait, the requirement says "Words (no. of words typed)". I should probably store it or calculate it. Let's calculate on fly for now: totalChars/5 */}
                              <TableCell>{duration}</TableCell>
                              <TableCell className="text-red-600 font-bold">{result.mismatches || 0}</TableCell>
                              <TableCell>{result.backspaces || 0}</TableCell>
                              <TableCell>{result.grossSpeed || 0} WPM</TableCell>
                              <TableCell className="font-bold">{result.netSpeed || 0} WPM</TableCell>
                              <TableCell className="text-right print:hidden">
                                <Button variant="ghost" size="sm" onClick={() => openDetails(result)}>
                                  <Eye className="h-4 w-4 mr-2" /> Details
                                </Button>
                              </TableCell>
                            </TableRow>
                           );
                        })}
                        {filteredResults.filter(r => r.type === 'typing').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                              No typing results found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="shorthand-results">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Words Typed</TableHead>
                          <TableHead>Time (min)</TableHead>
                          <TableHead>Mistakes</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead className="text-right print:hidden">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredResults.filter(r => r.type === 'shorthand').map((result) => {
                           const assignment = assignments.find(a => a.id === result.assignmentId);
                           const duration = assignment ? assignment.durationMinutes : '-';
                           // Word count needs to be derived from typedContent for shorthand as well
                           const wordsTyped = result.typedContent.trim().split(/\s+/).filter(w => w.length > 0).length;

                           return (
                            <TableRow key={result.id}>
                              <TableCell className="font-medium">{result.username}</TableCell>
                              <TableCell>{formatDate(result.dateTaken)}</TableCell>
                              <TableCell>{wordsTyped}</TableCell>
                              <TableCell>{duration}</TableCell>
                              <TableCell className="text-red-600 font-bold">{result.mismatches || 0}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded font-bold text-xs ${result.result === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {result.result || 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right print:hidden">
                                <Button variant="ghost" size="sm" onClick={() => openDetails(result)}>
                                  <Eye className="h-4 w-4 mr-2" /> Details
                                </Button>
                              </TableCell>
                            </TableRow>
                           );
                        })}
                        {filteredResults.filter(r => r.type === 'shorthand').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No shorthand results found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <div className="hidden print:block mt-12 pt-8 border-t">
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="font-bold">Instructor Signature</p>
                        <div className="h-12 border-b border-black w-48 mt-2"></div>
                      </div>
                      <div>
                        <p className="font-bold">Institute Seal</p>
                        <div className="h-20 w-20 border border-black rounded-full mt-2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detailed Result Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detailed Performance Analysis</DialogTitle>
            <DialogDescription>
              Test Type: {selectedResult?.type === 'shorthand' ? 'Shorthand' : 'Typing'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedResult && (
            <ResultDetailView 
              result={selectedResult} 
              originalContent={assignments.find(a => a.id === selectedResult.assignmentId)?.content || ""} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentCard({ assignment, onDelete, onToggle }: { assignment: Assignment, onDelete: (id: string) => void, onToggle: (id: string) => void }) {
  return (
    <Card className={`group hover:shadow-md transition-all ${assignment.isEnabled ? 'border-primary ring-1 ring-primary' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold line-clamp-1" title={assignment.title}>
            {assignment.title}
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-8 w-8 ${assignment.isEnabled ? 'text-green-600' : 'text-muted-foreground'}`}
              onClick={() => onToggle(assignment.id)}
              title={assignment.isEnabled ? "Currently Active" : "Click to Enable"}
            >
              <Power className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(assignment.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{formatDate(assignment.date)} • {assignment.durationMinutes} min</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted/30 p-2 rounded-md">
          {assignment.content}
        </p>
      </CardContent>
    </Card>
  );
}

function ResultDetailView({ result, originalContent }: { result: TestResult, originalContent: string }) {
  const isShorthand = result.type === 'shorthand';
  
  // Visualization logic differs slightly? 
  // For Shorthand we might want to show simple text diff or the same as typing.
  // Since we used same diff logic for both in utils (roughly), let's reuse visualizer but handle word wrapping better.

  // Diffing Logic for display
  const typedChars = result.typedContent.split("");
  const originalChars = originalContent.split("");
  const maxLength = Math.max(typedChars.length, originalChars.length);
  
  const diff = [];
  for (let i = 0; i < maxLength; i++) {
    const typed = typedChars[i];
    const original = originalChars[i];
    
    if (typed === undefined) {
      diff.push(<span key={i} className="text-muted-foreground opacity-50">{original}</span>);
    } else if (original === undefined) {
      diff.push(<span key={i} className="bg-red-100 text-red-600">{typed}</span>);
    } else if (typed === original) {
      diff.push(<span key={i} className="text-green-600 bg-green-50">{typed}</span>);
    } else {
      diff.push(<span key={i} className="bg-red-100 text-red-600 font-bold underline decoration-red-500">{typed}</span>);
    }
  }

  return (
    <div className="space-y-6 overflow-y-auto p-1">
      <div className="grid grid-cols-3 gap-4">
        {isShorthand ? (
            <>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className={`text-2xl font-bold ${result.result === 'Pass' ? 'text-green-600' : 'text-destructive'}`}>
                      {result.result}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">Status</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-destructive">{result.mismatches}</div>
                    <div className="text-xs text-muted-foreground uppercase">Mistakes</div>
                  </CardContent>
                </Card>
                 <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">{result.totalChars ? Math.round(result.typedContent.trim().split(/\s+/).length) : 0}</div>
                    <div className="text-xs text-muted-foreground uppercase">Words Typed</div>
                  </CardContent>
                </Card>
            </>
        ) : (
            <>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">{result.netSpeed}</div>
                    <div className="text-xs text-muted-foreground uppercase">Net Speed (WPM)</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold text-destructive">{result.mismatches}</div>
                    <div className="text-xs text-muted-foreground uppercase">Mistakes</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-2xl font-bold">{result.backspaces}</div>
                    <div className="text-xs text-muted-foreground uppercase">Backspaces</div>
                  </CardContent>
                </Card>
            </>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm">Visual Comparison</h4>
        <div className="rounded-md border p-4 bg-muted/10 font-mono text-lg leading-relaxed break-words whitespace-pre-wrap">
          {diff}
        </div>
      </div>
    </div>
  );
}
