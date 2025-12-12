import { useState } from "react";
import { useMockStore, Content, Result, User, PdfFolder } from "@/lib/store";
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
import { Download, Printer, Search, FileUp, Eye, EyeOff, FolderPlus, Upload, File, Music, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateResultPDF } from "@/lib/utils";

export default function AdminDashboard() {
  const { 
    content, addContent, toggleContent, results, users, updateUser, 
    registrationFee, setRegistrationFee, pdfFolders, addPdfFolder, addPdfResource,
    qrCodeUrl, setQrCodeUrl
  } = useMockStore();
  const { toast } = useToast();
  
  // Upload State
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<'typing' | 'shorthand'>("typing");
  const [textContent, setTextContent] = useState("");
  const [duration, setDuration] = useState("5");
  const [dateFor, setDateFor] = useState(format(new Date(), "yyyy-MM-dd"));
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const [audioFile, setAudioFile] = useState<File | null>(null); // Mock file handling

  // Filter State
  const [studentFilter, setStudentFilter] = useState("");
  const [studentListSearch, setStudentListSearch] = useState("");
  
  // PDF Store State
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [pdfName, setPdfName] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState("");

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim() && !audioFile) {
      toast({ variant: "destructive", title: "Error", description: "Content text or audio is required" });
      return;
    }

    addContent({
      title,
      type: contentType,
      text: textContent,
      duration: parseInt(duration),
      dateFor,
      language,
      mediaUrl: audioFile ? URL.createObjectURL(audioFile) : undefined // Mock URL
    });

    toast({ title: "Success", description: "Content uploaded successfully" });
    setTitle("");
    setTextContent("");
    setAudioFile(null);
  };

  const handleStudentPaymentToggle = (student: User) => {
    updateUser(student.id, { isPaymentCompleted: !student.isPaymentCompleted });
    toast({ 
      title: "Updated", 
      description: `Payment status for ${student.name} updated.` 
    });
  };

  const handleCreateFolder = () => {
    if (!newFolderName) return;
    addPdfFolder(newFolderName);
    setNewFolderName("");
    toast({ title: "Success", description: "Folder created" });
  };

  const handleUploadPdf = () => {
    if (!selectedFolderId || !pdfName || !pdfPageCount) {
      toast({ variant: "destructive", title: "Error", description: "All fields required" });
      return;
    }
    addPdfResource({
      name: pdfName,
      folderId: selectedFolderId,
      pageCount: parseInt(pdfPageCount),
      price: parseInt(pdfPageCount) * 1, // 1 rupee per page logic
      url: "#", // Mock URL
    });
    toast({ title: "Success", description: "PDF Resource added" });
    setPdfName("");
    setPdfPageCount("");
  };

  const handleDownloadResult = (result: Result) => {
    generateResultPDF(result);
  };

  const filteredResults = results
    .filter(r => 
      r.studentName.toLowerCase().includes(studentFilter.toLowerCase()) || 
      r.studentId.toLowerCase().includes(studentFilter.toLowerCase())
    )
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const filteredStudents = users.filter(u => 
    u.role === 'student' && (
      u.name.toLowerCase().includes(studentListSearch.toLowerCase()) ||
      u.studentId?.toLowerCase().includes(studentListSearch.toLowerCase()) ||
      u.mobile.includes(studentListSearch)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="manage">Tests</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="pdfstore">PDF Store</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Test Content</CardTitle>
              <CardDescription>Add typing or shorthand content.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Test Title" required />
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
                    <Label>Language</Label>
                    <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi (Mangal)</SelectItem>
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
                  
                  {contentType === 'shorthand' && (
                    <div className="space-y-2">
                      <Label>Audio File (Optional)</Label>
                      <Input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Content Text (Transcript)</Label>
                  <Textarea 
                    value={textContent} 
                    onChange={e => setTextContent(e.target.value)} 
                    placeholder="Paste text here..."
                    className="h-64 font-mono"
                  />
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
              <CardTitle>Manage Tests</CardTitle>
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
                            <TableHead>Lang</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Enable</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {content.filter(c => c.type === type).map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{format(new Date(item.dateFor), "MMM d")}</TableCell>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell className="capitalize">{item.language}</TableCell>
                              <TableCell>{item.duration} min</TableCell>
                              <TableCell>
                                {item.isEnabled ? (
                                  <span className="text-green-600 font-bold text-xs">Active</span>
                                ) : (
                                  <span className="text-gray-400 text-xs">Inactive</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
                                    <div className="mt-4 max-h-[60vh] overflow-auto p-4 bg-muted rounded">
                                      <p className="whitespace-pre-wrap">{item.text}</p>
                                      {item.mediaUrl && <div className="mt-2 text-xs text-blue-600 flex items-center gap-1"><Music size={12}/> Audio Attached</div>}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                              <TableCell>
                                <Switch checked={item.isEnabled} onCheckedChange={() => toggleContent(item.id)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription>Manage student access and payments.</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <Label>Reg Fee:</Label>
                    <Input 
                      type="number" 
                      className="w-24" 
                      value={registrationFee} 
                      onChange={e => setRegistrationFee(Number(e.target.value))} 
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <Label className="whitespace-nowrap">QR Code:</Label>
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="w-full max-w-xs" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setQrCodeUrl(URL.createObjectURL(file));
                      }} 
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students by Name, ID or Mobile..." 
                  className="pl-8" 
                  value={studentListSearch}
                  onChange={e => setStudentListSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>City/State</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.studentId}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.mobile}</TableCell>
                        <TableCell>{student.city}, {student.state}</TableCell>
                        <TableCell>
                          {student.isPaymentCompleted ? (
                            <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="h-4 w-4"/> Paid</span>
                          ) : (
                            <span className="text-red-500 font-bold">Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={student.isPaymentCompleted} 
                              onCheckedChange={() => handleStudentPaymentToggle(student)} 
                            />
                            <Label className="text-xs">{student.isPaymentCompleted ? 'Enabled' : 'Disabled'}</Label>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No students found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdfstore" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>PDF Store Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-semibold">Create Folder</h3>
                  <div className="flex gap-2">
                    <Input placeholder="Folder Name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                    <Button onClick={handleCreateFolder}><FolderPlus className="mr-2 h-4 w-4"/> Create</Button>
                  </div>
                  
                  <div className="mt-4 border rounded p-4">
                    <h4 className="text-sm font-medium mb-2">Existing Folders</h4>
                    <div className="space-y-1">
                      {pdfFolders.map(f => (
                        <div key={f.id} className="text-sm p-2 bg-muted rounded flex items-center gap-2">
                          <FolderPlus size={14} /> {f.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Upload PDF Resource</h3>
                  <div className="space-y-2">
                    <Label>Select Folder</Label>
                    <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                      <SelectTrigger><SelectValue placeholder="Select Folder" /></SelectTrigger>
                      <SelectContent>
                        {pdfFolders.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>PDF Name</Label>
                    <Input value={pdfName} onChange={e => setPdfName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Count (Price = 1 * Pages)</Label>
                    <Input type="number" value={pdfPageCount} onChange={e => setPdfPageCount(e.target.value)} />
                  </div>
                  <Button onClick={handleUploadPdf} className="w-full"><Upload className="mr-2 h-4 w-4"/> Upload PDF</Button>
                </div>
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

