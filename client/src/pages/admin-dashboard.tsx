import { useState, useRef, useCallback, useEffect } from "react";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
import { useAuth, useContent, useResults, useUsers, usePdf, useSettings, useGallery, useSelectedCandidates, useDictations } from "@/lib/hooks";
import type { User, Result } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Download, Search, FileUp, Eye, FolderPlus, Upload, Music, CheckCircle, Image as ImageIcon, LayoutList, Users, BarChart, Trash2, QrCode, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateResultPDF } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ResultTextAnalysis } from "@/components/ResultTextAnalysis";

export default function AdminDashboard() {
  const { content, createContent, toggleContent, deleteContent } = useContent();
  const { results } = useResults();
  const { users, updateUser, deleteUser } = useUsers();
  const { folders: pdfFolders, resources: pdfResources, createFolder: addPdfFolder, createResource: addPdfResource, deleteResource: deletePdfResource } = usePdf();
  const { settings, updateSettings } = useSettings();
  const { images: galleryImages, addImage: addGalleryImage, deleteImage: removeGalleryImage } = useGallery();
  const { candidates: selectedCandidates, addCandidate: addSelectedCandidate, deleteCandidate: removeSelectedCandidate } = useSelectedCandidates();
  const { dictations, createDictation: addDictation, toggleDictation, deleteDictation } = useDictations();
  const { toast } = useToast();
  
  const registrationFee = settings?.registrationFee || 0;
  const qrCodeUrl = settings?.qrCodeUrl || '';
  const [localRegFee, setLocalRegFee] = useState<number>(registrationFee);
  const setQrCodeUrl = (url: string) => updateSettings?.({ qrCodeUrl: url });

  useEffect(() => {
    setLocalRegFee(registrationFee);
  }, [registrationFee]);

  useEffect(() => {
    if (localRegFee === registrationFee) return;
    const timer = setTimeout(() => {
      updateSettings?.({ registrationFee: localRegFee });
    }, 3000);
    return () => clearTimeout(timer);
  }, [localRegFee]);
  
  const [activeTab, setActiveTab] = useState("students");

  // Upload State
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<'typing' | 'shorthand'>("typing");
  const [textContent, setTextContent] = useState("");
  const [duration, setDuration] = useState("5");
  const [dateFor, setDateFor] = useState(format(new Date(), "yyyy-MM-dd"));
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Filter State
  const [studentFilter, setStudentFilter] = useState("");
  const [studentListSearch, setStudentListSearch] = useState("");
  
  // PDF Store State
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pdfPageCount, setPdfPageCount] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  
  // Dictation State - Merged into Upload
  const [dictationFile, setDictationFile] = useState<File | null>(null);
  const dictationFileInputRef = useRef<HTMLInputElement>(null);

  // Analysis State
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  // Candidate State
  const [candidateName, setCandidateName] = useState("");
  const [candidateDesignation, setCandidateDesignation] = useState("");
  const [candidateYear, setCandidateYear] = useState("");
  const [candidateImage, setCandidateImage] = useState<File | null>(null);

  const handleAddCandidate = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!candidateName || !candidateImage) {
        toast({ variant: "destructive", title: "Error", description: "Name and Image are required" });
        return;
     }
     
     const imageUrl = await fileToBase64(candidateImage);
     addSelectedCandidate({
        name: candidateName,
        designation: candidateDesignation,
        year: candidateYear,
        imageUrl: imageUrl
     });
     
     toast({ title: "Success", description: "Candidate added" });
     setCandidateName("");
     setCandidateDesignation("");
     setCandidateYear("");
     setCandidateImage(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Content text is required" });
      return;
    }
    
    // Create base64 URL for audio if shorthand
    let mediaUrl = undefined;
    if (contentType === 'shorthand' && dictationFile) {
      mediaUrl = await fileToBase64(dictationFile);
    }

    await createContent({
      title,
      type: contentType,
      text: textContent,
      duration: parseInt(duration),
      dateFor,
      language,
      mediaUrl, // Attach audio URL
    });

    toast({ title: "Success", description: "Content uploaded successfully" });
    setTitle("");
    setTextContent("");
    setDictationFile(null);
    if (dictationFileInputRef.current) {
      dictationFileInputRef.current.value = "";
    }
  };

  // Deprecated: handleUploadDictation removed

  const handleStudentPaymentToggle = async (student: User) => {
    await updateUser({ id: student.id, data: { isPaymentCompleted: !student.isPaymentCompleted } });
    toast({ 
      title: "Updated", 
      description: `Payment status for ${student.name} updated.` 
    });
  };
  
  const handleDeleteStudent = async (id: number) => {
    if (confirm("Are you sure you want to delete this student? This cannot be undone.")) {
      await deleteUser(id);
      toast({ title: "Deleted", description: "Student profile removed." });
    }
  };
  
  const handleDeleteContent = async (id: number) => {
    if (confirm("Are you sure you want to delete this test?")) {
      await deleteContent(id);
      toast({ title: "Deleted", description: "Test content removed." });
    }
  };

  const handleCreateFolder = () => {
    if (!newFolderName) return;
    addPdfFolder(newFolderName);
    setNewFolderName("");
    toast({ title: "Success", description: "Folder created" });
  };

  const handleUploadPdf = async () => {
    if (!selectedFolderId || !pdfName || !pdfPageCount) {
      toast({ variant: "destructive", title: "Error", description: "All fields required" });
      return;
    }
    
    const url = pdfFile ? await fileToBase64(pdfFile) : "#";

    addPdfResource({
      name: pdfName,
      folderId: selectedFolderId,
      pageCount: parseInt(pdfPageCount),
      price: parseInt(pdfPageCount) * 1, 
      url: url,
    });
    toast({ title: "Success", description: "PDF/Doc Resource added" });
    setPdfName("");
    setPdfPageCount("");
    setPdfFile(null);
  };

  const handleUploadGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      for (const file of Array.from(e.target.files)) {
        const url = await fileToBase64(file);
        addGalleryImage(url);
      }
      toast({ title: "Success", description: "Images uploaded to gallery" });
    }
  };
  
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const url = await fileToBase64(e.target.files[0]);
      setQrCodeUrl(url);
      toast({ title: "Updated", description: "QR Code updated successfully" });
    }
  };

  const handleDeletePdf = async (id: number) => {
    if (confirm("Are you sure you want to delete this PDF resource?")) {
      await deletePdfResource(id);
      toast({ title: "Deleted", description: "PDF resource removed." });
    }
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

  const totalStudents = users.filter(u => u.role === 'student').length;
  const enabledStudents = users.filter(u => u.role === 'student' && u.isPaymentCompleted).length;
  const disabledStudents = totalStudents - enabledStudents;

  console.log("content ****", content)

  const renderContent = () => {
    switch (activeTab) {
      case "students":
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription className="flex flex-wrap gap-2 mt-1">
                    <span className="font-medium">Total: {totalStudents}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-green-600 font-medium">Enabled: {enabledStudents}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-red-600 font-medium">Disabled: {disabledStudents}</span>
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full lg:w-auto">
                  <div className="flex items-center gap-2">
                    <Label>Reg Fee:</Label>
                    <Input type="number" className="w-24" value={localRegFee} onChange={e => setLocalRegFee(Number(e.target.value))} />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="whitespace-nowrap">QR Code:</Label>
                     <div className="flex items-center gap-2">
                       {qrCodeUrl && (
                         <Dialog>
                           <DialogTrigger asChild>
                             <Button variant="ghost" size="icon"><QrCode className="h-4 w-4"/></Button>
                           </DialogTrigger>
                           <DialogContent>
                             <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-sm mx-auto" />
                           </DialogContent>
                         </Dialog>
                       )}
                       <Input type="file" accept="image/*" className="w-full max-w-[180px]" onChange={handleQrUpload} />
                     </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students..." className="pl-8" value={studentListSearch} onChange={e => setStudentListSearch(e.target.value)} />
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
                      <TableHead>Payment</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Actions</TableHead>
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
                          {student.isPaymentCompleted ? 
                            <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="h-4 w-4"/> Paid</span> : 
                            <span className="text-red-500 font-bold">Pending</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={student.isPaymentCompleted} onCheckedChange={() => handleStudentPaymentToggle(student)} />
                            <Label className="text-xs hidden sm:inline">{student.isPaymentCompleted ? 'Enabled' : 'Disabled'}</Label>
                          </div>
                        </TableCell>
                        <TableCell>
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => handleDeleteStudent(student.id)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      case "upload":
        return (
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="typing">Typing Test</SelectItem>
                        <SelectItem value="shorthand">Shorthand Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {contentType === 'shorthand' && (
                    <div className="space-y-2">
                       <Label>Audio File (Required for Shorthand)</Label>
                       <Input type="file" accept="audio/*" onChange={e => setDictationFile(e.target.files?.[0] || null)} ref={dictationFileInputRef} required={contentType === 'shorthand'} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi (Mangal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Minutes)</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label>Content Text (Transcript)</Label>
                  <Textarea 
                    value={textContent} 
                    onChange={e => setTextContent(e.target.value)} 
                    placeholder="Paste text here..."
                    className={cn(
                      "h-64 font-mono",
                      language === 'hindi' ? "font-mangal" : ""
                    )}
                  />
                </div>

                <Button type="submit"><FileUp className="mr-2 h-4 w-4" /> Upload Content</Button>
              </form>
            </CardContent>
          </Card>
        );
      case "manage":
        return (
          <Card>
            <CardHeader><CardTitle>Manage Tests</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-8">
                {['typing', 'shorthand'].map(type => (
                  <div key={type} className="space-y-4">
                    <h3 className="text-lg font-semibold capitalize border-b pb-2">{type} Tests</h3>
                    <div className="rounded-md border max-h-[300px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Lang</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {content
                            .filter(c => c.type === type)
                            .sort((a, b) => {
                              if (a.isEnabled !== b.isEnabled) return b.isEnabled ? 1 : -1;
                              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            })
                            .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{format(new Date(item.dateFor), "MMM d")}</TableCell>
                              <TableCell className="font-medium">{item.title}</TableCell>
                              <TableCell className="capitalize">{item.language}</TableCell>
                              <TableCell>{item.duration} min</TableCell>
                              <TableCell>
                                {item.isEnabled ? <span className="text-green-600 font-bold text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>}
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>{item.title}</DialogTitle></DialogHeader>
                                    <div className="mt-4 max-h-[60vh] overflow-auto p-4 bg-muted rounded">
                                      <p className="whitespace-pre-wrap">{item.text}</p>
                                      {item.mediaUrl && <div className="mt-2 text-xs text-blue-600 flex items-center gap-1"><Music size={12}/> Audio Attached</div>}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                      {/* Mock result download for admin preview */}
                                      {/* <Button variant="outline" size="sm" onClick={() => generateResultPDF({
                                        id: "preview",
                                        studentId: "admin",
                                        studentName: "Admin Preview",
                                        contentId: item.id,
                                        contentTitle: item.title,
                                        contentType: item.type,
                                        language: item.language,
                                        originalText: item.text,
                                        typedText: item.text, // Perfect match for preview
                                        submittedAt: new Date().toISOString(),
                                        metrics: {
                                          words: item.text.split(" ").length,
                                          mistakes: 0,
                                          grossSpeed: 0,
                                          netSpeed: 0,
                                          backspaces: 0,
                                          result: "Pass",
                                          time: item.duration
                                        }
                                      })}>
                                        <Download className="mr-2 h-4 w-4" /> Download PDF Preview
                                      </Button> */}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch checked={item.isEnabled} onCheckedChange={() => toggleContent(parseInt(item.id))} />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => handleDeleteContent(parseInt(item.id))}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
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
        );
      case "pdfstore":
        return (
          <Card>
            <CardHeader><CardTitle>PDF Store Management</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-semibold">Create Folder</h3>
                  <div className="flex gap-2">
                    <Input placeholder="Folder Name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                    <Button onClick={handleCreateFolder}><FolderPlus className="mr-2 h-4 w-4"/> Create</Button>
                  </div>
                  <div className="mt-4 border rounded p-4 max-h-60 overflow-auto">
                    <h4 className="text-sm font-medium mb-2">Existing Folders</h4>
                    <div className="space-y-1">
                      {pdfFolders.map(f => (
                        <div 
                          key={f.id} 
                          className={cn(
                            "text-sm p-2 rounded flex items-center justify-between cursor-pointer hover:bg-muted",
                            selectedFolderId === parseInt(f.id) ? "bg-muted font-medium" : ""
                          )}
                          onClick={() => setSelectedFolderId(parseInt(f.id))}
                        >
                          <div className="flex items-center gap-2">
                            <FolderPlus size={14} className="text-blue-500" /> {f.name}
                          </div>
                          <span className="text-xs text-muted-foreground bg-white px-1.5 rounded border">
                            {pdfResources.filter(p => p.folderId === f.id).length}
                          </span>
                        </div>
                      ))}
                      {pdfFolders.length === 0 && <p className="text-muted-foreground text-xs italic">No folders created yet.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Upload PDF/Doc Resource</h3>
                  {selectedFolderId ? (
                    <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                      <div className="text-sm font-medium text-blue-800 flex items-center gap-2 mb-2">
                        <FolderPlus size={16}/> 
                        Selected: {pdfFolders.find(f => parseInt(f.id) === selectedFolderId)?.name}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Resource Name</Label>
                        <Input value={pdfName} onChange={e => setPdfName(e.target.value)} placeholder="e.g. Chapter 1 Notes" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input type="number" value={pdfPageCount} onChange={e => setPdfPageCount(e.target.value)} placeholder="e.g. 99" />
                        </div>
                        <div className="space-y-2">
                          <Label>Upload File</Label>
                          <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                        </div>
                      </div>
                      <Button onClick={handleUploadPdf} className="w-full"><Upload className="mr-2 h-4 w-4"/> Upload Resource</Button>
                      
                      <div className="mt-6 border-t pt-4">
                        <h4 className="font-semibold mb-2 text-sm">Files in Folder</h4>
                        <div className="space-y-2 max-h-48 overflow-auto">
                          {pdfResources.filter(p => parseInt(p.folderId) === selectedFolderId).map(pdf => (
                            <div key={pdf.id} className="flex items-center justify-between p-2 border rounded text-sm bg-white">
                              <div className="flex flex-col overflow-hidden">
                                <span className="truncate font-medium">{pdf.name}</span>
                                <span className="text-xs text-muted-foreground">{pdf.pageCount} pages • ₹{pdf.price}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDeletePdf(parseInt(pdf.id))}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                          {pdfResources.filter(p => parseInt(p.folderId) === selectedFolderId).length === 0 && (
                            <p className="text-muted-foreground text-xs text-center py-4 border border-dashed rounded">No files in this folder.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground bg-muted/10">
                      <FolderPlus className="h-10 w-10 mb-2 opacity-20" />
                      <p>Select a folder from the left to manage files</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      case "results":
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Results</CardTitle>
                  <CardDescription>View and download performance reports.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search student..." className="pl-8" value={studentFilter} onChange={e => setStudentFilter(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="typing" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="typing">Typing Results</TabsTrigger>
                  <TabsTrigger value="shorthand">Shorthand Results</TabsTrigger>
                </TabsList>

                {['typing', 'shorthand'].map(type => (
                  <TabsContent key={type} value={type}>
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
                            .filter(r => r.contentType === type)
                            .map((result) => (
                              <TableRow key={result.id}>
                                <TableCell>
                                  <div className="font-medium">{result.studentName}</div>
                                  <div className="text-xs text-muted-foreground">{result.studentDisplayId || result.studentId}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{result.contentTitle}</div>
                                  <div className="text-xs text-muted-foreground capitalize">{result.language}</div>
                                </TableCell>
                                <TableCell>{format(new Date(result.submittedAt), "MMM d, p")}</TableCell>
                                <TableCell>
                                  <div className="text-sm space-y-1">
                                    {result.contentType === 'typing' ? (
                                      <>
                                        <div><span className="text-muted-foreground">Net Speed:</span> <strong>{result.netSpeed} WPM</strong></div>
                                        <div><span className="text-muted-foreground">Mistakes:</span> {result.mistakes}</div>
                                      </>
                                    ) : (
                                      <>
                                        <div><span className="text-muted-foreground">Result:</span> 
                                          <span className={result.result === 'Pass' ? "text-green-600 font-bold ml-1" : "text-red-600 font-bold ml-1"}>
                                            {result.result}
                                          </span>
                                        </div>
                                        <div><span className="text-muted-foreground">Mistakes:</span> {result.mistakes}</div>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" onClick={() => setSelectedResult(result)}>
                                        <Eye className="h-4 w-4 mr-1" /> View
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                      <DialogHeader>
                                        <DialogTitle>Result Analysis</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            <span className="font-semibold">Test:</span> {result.contentTitle}
                                          </div>
                                          <div>
                                            <span className="font-semibold">Date:</span> {format(new Date(result.submittedAt), "PPP")}
                                          </div>
                                          <div>
                                            <span className="font-semibold">Mistakes:</span> <span className="text-red-600 font-bold">{result.mistakes}</span>
                                          </div>
                                          <div>
                                            <span className="font-semibold">Total Original Words:</span> <span>{(result.originalText || "").trim().split(/\s+/).length}</span>
                                          </div>
                                          <div>
                                            {result.contentType === "typing" ? (
                                              <span>
                                                <span className="font-semibold">Net Speed:</span> {result.netSpeed} WPM
                                              </span>
                                            ) : (
                                              <span>
                                                <span className="font-semibold">Result:</span>{" "}
                                                <span className={result.result === "Pass" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                  {result.result}
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="border rounded p-4 bg-muted/30">
                                          <h4 className="font-semibold mb-2">Your Input</h4>
                                          <ResultTextAnalysis 
                                            originalText={result.originalText || ""} 
                                            typedText={result.typedText} 
                                            language={result.language}
                                          />
                                        </div>

                                        <div className="border rounded p-4 bg-muted/30">
                                          <h4 className="font-semibold mb-2">Original Text</h4>
                                          <p className={cn("text-sm whitespace-pre-wrap", result.language === 'hindi' ? "font-mangal" : "")}>
                                            {result.originalText}
                                          </p>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                          <Button onClick={() => handleDownloadResult(result)}>
                                            <Download className="mr-2 h-4 w-4" /> Download PDF Report
                                          </Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button variant="outline" size="sm" onClick={() => handleDownloadResult(result)}>
                                    <Download className="h-4 w-4 mr-1" /> PDF
                                  </Button>
                                </TableCell>
                              </TableRow>
                          ))}
                          {filteredResults.filter(r => r.contentType === type).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No results found.</TableCell>
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
        );
      case "gallery":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Gallery & Selected Candidates</CardTitle>
              <CardDescription>Manage images and top students.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="gallery_images">
                <TabsList className="mb-4">
                  <TabsTrigger value="gallery_images">Gallery Images</TabsTrigger>
                  <TabsTrigger value="selected_candidates">Selected Candidates</TabsTrigger>
                </TabsList>
                
                <TabsContent value="gallery_images">
                  <div className="space-y-6">
                    <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center">
                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                      <Label htmlFor="gallery-upload" className="cursor-pointer">
                        <span className="text-primary font-semibold hover:underline">Click to upload</span> or drag and drop
                        <p className="text-sm text-muted-foreground mt-1">JPG, JPEG, PNG (Bulk upload supported)</p>
                      </Label>
                      <Input 
                        id="gallery-upload" 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                        onChange={handleUploadGallery} 
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {galleryImages.map((url, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
                          <img src={url} alt="Gallery" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button variant="destructive" size="icon" onClick={() => removeGalleryImage(url)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="selected_candidates">
                  <div className="space-y-6">
                    <form onSubmit={handleAddCandidate} className="space-y-4 border rounded-lg p-4 bg-slate-50">
                       <h3 className="font-semibold text-sm mb-2">Add New Candidate</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Student Name" required />
                          </div>
                          <div className="space-y-2">
                            <Label>Designation</Label>
                            <Input value={candidateDesignation} onChange={e => setCandidateDesignation(e.target.value)} placeholder="e.g. Stenographer" required />
                          </div>
                          <div className="space-y-2">
                            <Label>Batch Year</Label>
                            <Input value={candidateYear} onChange={e => setCandidateYear(e.target.value)} placeholder="e.g. 2024" required />
                          </div>
                          <div className="space-y-2">
                            <Label>Photo</Label>
                            <Input type="file" accept="image/*" onChange={e => setCandidateImage(e.target.files?.[0] || null)} required />
                          </div>
                          <Button type="submit"><Users className="mr-2 h-4 w-4"/> Add</Button>
                       </div>
                    </form>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Photo</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Designation</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCandidates.map((candidate) => (
                            <TableRow key={candidate.id}>
                              <TableCell>
                                <div className="h-10 w-10 rounded-full overflow-hidden border">
                                  <img src={candidate.imageUrl} alt={candidate.name} className="h-full w-full object-cover" />
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{candidate.name}</TableCell>
                              <TableCell>{candidate.designation}</TableCell>
                              <TableCell>{candidate.year}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeSelectedCandidate(candidate.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {selectedCandidates.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No candidates added yet.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col p-4 space-y-2 shrink-0 overflow-y-auto">
        <h2 className="px-4 text-xs font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Menu</h2>
        {[
          { id: "students", label: "Students", icon: Users },
          { id: "upload", label: "Upload New Tests", icon: FileUp },
          { id: "manage", label: "Manage Tests", icon: LayoutList },
          { id: "pdfstore", label: "Pdf store", icon: FolderPlus },
          { id: "results", label: "Results", icon: BarChart },
          { id: "gallery", label: "Gallery upload", icon: ImageIcon },
        ].map(item => (
          <Button
            key={item.id}
            variant={activeTab === item.id ? "secondary" : "ghost"}
            className={cn("justify-start gap-3", activeTab === item.id && "bg-white shadow-sm")}
            onClick={() => setActiveTab(item.id)}
          >
            <item.icon size={18} />
            <span className="truncate">{item.label}</span>
          </Button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto bg-slate-50/50">
        {renderContent()}
      </main>
    </div>
  );
}