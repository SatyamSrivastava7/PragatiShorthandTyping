import { useState, useRef } from "react";
import { useStore, Assignment, TestResult } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Download, Printer, FileText, History, Eye } from "lucide-react";
import { useReactToPrint } from 'react-to-print';

export default function AdminDashboard() {
  const { assignments, results, addAssignment, deleteAssignment } = useStore();
  const { toast } = useToast();
  
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDuration, setNewDuration] = useState("2");
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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

  const openDetails = (result: TestResult) => {
    setSelectedResult(result);
    setIsDetailOpen(true);
  };

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
                <DialogTitle>Upload Typing Content</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
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

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-2">
          <TabsTrigger value="assignments" className="gap-2">
            <FileText className="h-4 w-4" /> Managed Content
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <History className="h-4 w-4" /> Student Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="group hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold line-clamp-1" title={assignment.title}>
                      {assignment.title}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>{formatDate(assignment.date)} • {assignment.durationMinutes} min</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted/30 p-2 rounded-md">
                    {assignment.content}
                  </p>
                </CardContent>
              </Card>
            ))}
            {assignments.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No content uploaded yet. Click "Upload New Content" to start.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Student Performance Reports</CardTitle>
                <CardDescription>View and print detailed analysis of student typing tests.</CardDescription>
              </div>
              <div className="flex gap-2">
                 {results.length > 0 && (
                   <Button variant="outline" className="gap-2" onClick={() => handlePrint && handlePrint()}>
                     <Printer className="h-4 w-4" /> Print Report
                   </Button>
                 )}
              </div>
            </CardHeader>
            <CardContent>
              <div ref={printRef} className="p-4 print:p-0">
                <div className="hidden print:block mb-8 text-center border-b pb-4">
                  <h1 className="text-2xl font-bold">Pragati Institute</h1>
                  <p className="text-muted-foreground">Official Typing Test Results</p>
                  <p className="text-sm mt-2">Report Date: {formatDate(new Date().toISOString())}</p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Test Date</TableHead>
                      <TableHead>WPM</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Mismatches</TableHead>
                      <TableHead className="text-right print:hidden">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.username}</TableCell>
                        <TableCell>{formatDate(result.dateTaken)}</TableCell>
                        <TableCell>{result.wpm}</TableCell>
                        <TableCell className={result.accuracy >= 90 ? "text-green-600 font-bold" : "text-orange-600 font-bold"}>
                          {result.accuracy}%
                        </TableCell>
                        <TableCell>{result.mismatches}</TableCell>
                        <TableCell className="text-right print:hidden">
                          <Button variant="ghost" size="sm" onClick={() => openDetails(result)}>
                            <Eye className="h-4 w-4 mr-2" /> Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {results.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No results available yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

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
              Comparing student input against original content. Red indicates mismatches.
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

function ResultDetailView({ result, originalContent }: { result: TestResult, originalContent: string }) {
  const typedChars = result.typedContent.split("");
  const originalChars = originalContent.split("");
  
  // Use original length to show what was MISSED as well? 
  // Or just iterate over the max length to show extras?
  const maxLength = Math.max(typedChars.length, originalChars.length);
  
  const diff = [];
  for (let i = 0; i < maxLength; i++) {
    const typed = typedChars[i];
    const original = originalChars[i];
    
    if (typed === undefined) {
      // User stopped typing early (missing chars) - show gray/faded original
      diff.push(
        <span key={i} className="text-muted-foreground opacity-50">{original}</span>
      );
    } else if (original === undefined) {
      // User typed EXTRA chars - show red
      diff.push(
        <span key={i} className="bg-red-100 text-red-600">{typed}</span>
      );
    } else if (typed === original) {
      // Match - show green
      diff.push(
        <span key={i} className="text-green-600 bg-green-50">{typed}</span>
      );
    } else {
      // Mismatch - show red typed char
      diff.push(
        <span key={i} className="bg-red-100 text-red-600 font-bold decoration-red-500 underline decoration-wavy decoration-1">{typed}</span>
      );
    }
  }

  return (
    <div className="space-y-6 overflow-y-auto p-1">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{result.wpm}</div>
            <div className="text-xs text-muted-foreground uppercase">WPM</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className={`text-2xl font-bold ${result.accuracy >= 90 ? 'text-green-600' : 'text-orange-600'}`}>
              {result.accuracy}%
            </div>
            <div className="text-xs text-muted-foreground uppercase">Accuracy</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-destructive">{result.mismatches}</div>
            <div className="text-xs text-muted-foreground uppercase">Mismatches</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium text-sm">Visual Comparison</h4>
        <div className="rounded-md border p-4 bg-muted/10 font-mono text-lg leading-relaxed break-words whitespace-pre-wrap">
          {diff}
        </div>
        <p className="text-xs text-muted-foreground">
          Legend: <span className="text-green-600 bg-green-50 px-1 rounded">Green</span> = Correct, 
          <span className="bg-red-100 text-red-600 px-1 rounded ml-1">Red</span> = Mismatch/Extra, 
          <span className="opacity-50 ml-1">Gray</span> = Missed
        </p>
      </div>
    </div>
  );
}
