import { useState } from "react";
import { useMockStore, Content, Result } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Download, Printer, Search, FileUp, Eye, EyeOff } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminDashboard() {
  const { content, addContent, toggleContent, results, users } = useMockStore();
  const { toast } = useToast();
  
  // Upload State
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<'typing' | 'shorthand'>("typing");
  const [textContent, setTextContent] = useState("");
  const [duration, setDuration] = useState("5");
  const [dateFor, setDateFor] = useState(format(new Date(), "yyyy-MM-dd"));

  // Filter State
  const [studentFilter, setStudentFilter] = useState("");

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Content cannot be empty" });
      return;
    }

    addContent({
      title,
      type: contentType,
      text: textContent,
      duration: parseInt(duration),
      dateFor,
    });

    toast({ title: "Success", description: "Content uploaded successfully" });
    setTitle("");
    setTextContent("");
  };

  const handleDownloadResult = (result: Result) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Pragati Shorthand and Typing", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Student Report: ${result.studentName} (${result.studentId})`, 14, 25);
    doc.text(`Test: ${result.contentTitle} (${result.contentType.toUpperCase()})`, 14, 32);
    doc.text(`Date: ${format(new Date(result.submittedAt), "PPP p")}`, 14, 39);

    if (result.contentType === 'typing') {
      const data = [
        ["Metric", "Value"],
        ["Words Typed", result.metrics.words.toString()],
        ["Time Allocated", `${result.metrics.time} min`],
        ["Mistakes", result.metrics.mistakes.toString()],
        ["Backspaces", result.metrics.backspaces.toString()],
        ["Gross Speed", `${result.metrics.grossSpeed} WPM`],
        ["Net Speed", `${result.metrics.netSpeed} WPM`]
      ];
      
      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Value']],
        body: data.slice(1),
      });
      
    } else {
      const data = [
        ["Metric", "Value"],
        ["Words Typed", result.metrics.words.toString()],
        ["Time Allocated", `${result.metrics.time} min`],
        ["Mistakes", result.metrics.mistakes.toString()],
        ["Result", result.metrics.result || "N/A"]
      ];
       autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Value']],
        body: data.slice(1),
      });
    }

    // Add Typed Content snippet
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.text("Typed Content:", 14, finalY + 10);
    const splitText = doc.splitTextToSize(result.typedText, 180);
    doc.text(splitText, 14, finalY + 17);

    doc.save(`result_${result.studentId}_${result.id}.pdf`);
  };

  const filteredResults = results
    .filter(r => 
      r.studentName.toLowerCase().includes(studentFilter.toLowerCase()) || 
      r.studentId.toLowerCase().includes(studentFilter.toLowerCase())
    )
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="upload">Upload Content</TabsTrigger>
          <TabsTrigger value="manage">Manage Uploads</TabsTrigger>
          <TabsTrigger value="results">Student Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Test Content</CardTitle>
              <CardDescription>Add typing or shorthand content for students.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Batch A Morning Test" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Date For</Label>
                    <Input type="date" value={dateFor} onChange={e => setDateFor(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Test Type</Label>
                    <Select value={contentType} onValueChange={(v: any) => setContentType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="typing">Typing Test</SelectItem>
                        <SelectItem value="shorthand">Shorthand Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Minutes)</Label>
                    <Select value={duration} onValueChange={setDuration}>
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
                </div>
                
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea 
                    value={textContent} 
                    onChange={e => setTextContent(e.target.value)} 
                    placeholder={contentType === 'typing' ? "Paste text here..." : "Paste shorthand transcript here..."}
                    className="h-64 font-mono"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {contentType === 'shorthand' ? "This content will be HIDDEN from students. They will type from their hard copy." : "Students will see this content side-by-side."}
                  </p>
                </div>

                <Button type="submit" className="w-full md:w-auto">
                  <FileUp className="mr-2 h-4 w-4" /> Upload Content
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage Uploads</CardTitle>
              <CardDescription>Enable/Disable tests. Only one test can be active at a time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {['typing', 'shorthand'].map(type => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-lg font-semibold capitalize border-b pb-2">{type} Tests</h3>
                    <div className="rounded-md border max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {content.filter(c => c.type === type).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{format(new Date(item.dateFor), "MMM d, yyyy")}</TableCell>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell>{item.duration} min</TableCell>
                              <TableCell>
                                {item.isEnabled ? (
                                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Active</span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Inactive</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Switch 
                                    checked={item.isEnabled}
                                    onCheckedChange={() => toggleContent(item.id)}
                                  />
                                  <Label className="text-xs text-muted-foreground">
                                    {item.isEnabled ? "Enabled" : "Disabled"}
                                  </Label>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {content.filter(c => c.type === type).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No {type} content uploaded yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Results</CardTitle>
                  <CardDescription>View and download performance reports.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search student..." 
                    className="pl-8" 
                    value={studentFilter}
                    onChange={e => setStudentFilter(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="typing_results" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="typing_results">Typing Test Results</TabsTrigger>
                  <TabsTrigger value="shorthand_results">Shorthand Test Results</TabsTrigger>
                </TabsList>

                {['typing', 'shorthand'].map((resultType) => (
                  <TabsContent key={resultType} value={`${resultType}_results`}>
                    <div className="rounded-md border max-h-[600px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Test Title</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Metrics</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults
                            .filter(r => r.contentType === resultType)
                            .map((result) => (
                              <TableRow key={result.id}>
                                <TableCell>
                                  <div className="font-medium">{result.studentName}</div>
                                  <div className="text-xs text-muted-foreground">{result.studentId}</div>
                                </TableCell>
                                <TableCell>{result.contentTitle}</TableCell>
                                <TableCell>{format(new Date(result.submittedAt), "MMM d, p")}</TableCell>
                                <TableCell>
                                  <div className="text-sm space-y-1">
                                    {result.contentType === 'typing' ? (
                                      <>
                                        <div><span className="text-muted-foreground">Net Speed:</span> <strong>{result.metrics.netSpeed} WPM</strong></div>
                                        <div><span className="text-muted-foreground">Mistakes:</span> {result.metrics.mistakes}</div>
                                      </>
                                    ) : (
                                      <>
                                        <div><span className="text-muted-foreground">Result:</span> 
                                          <span className={result.metrics.result === 'Pass' ? "text-green-600 font-bold ml-1" : "text-red-600 font-bold ml-1"}>
                                            {result.metrics.result}
                                          </span>
                                        </div>
                                        <div><span className="text-muted-foreground">Mistakes:</span> {result.metrics.mistakes}</div>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadResult(result)}>
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </TableCell>
                              </TableRow>
                          ))}
                          {filteredResults.filter(r => r.contentType === resultType).length === 0 && (
                            <TableRow>
                               <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  No {resultType} results found.
                               </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
