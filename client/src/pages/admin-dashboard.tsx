import { useState, useRef, useCallback, useEffect } from "react";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
import { useAuth, useContent, usePrefetchContent, useResults, useUsers, usePdf, useSettings, useGallery, useSelectedCandidates, useDictations } from "@/lib/hooks";
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
import { Download, Search, FileUp, Eye, FolderPlus, Upload, Music, CheckCircle, Image as ImageIcon, LayoutList, Users, BarChart, Trash2, QrCode, Mic, Loader2, Keyboard } from "lucide-react";
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
  usePrefetchContent();
  const { content, createContent, toggleContent, deleteContent, isLoading: isContentLoading } = useContent();
  const { results } = useResults();
  const { users, updateUser, deleteUser } = useUsers();
  const { folders: pdfFolders, resources: pdfResources, createFolder: addPdfFolder, createResource: addPdfResource, deleteResource: deletePdfResource, deleteFolder: deletePdfFolder } = usePdf();
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
  
  // Upload Loading State
  const [isUploading, setIsUploading] = useState(false);

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
     
     toast({ variant: "success", title: "Success", description: "Candidate added" });
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
    
    setIsUploading(true);
    toast({ variant: "info", title: "Uploading...", description: "Please wait while content is being uploaded." });
    
    try {
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

      toast({ variant: "success", title: "Success", description: "Content uploaded successfully" });
      setTitle("");
      setTextContent("");
      setDictationFile(null);
      if (dictationFileInputRef.current) {
        dictationFileInputRef.current.value = "";
      }
    } finally {
      setIsUploading(false);
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
    toast({ variant: "success", title: "Success", description: "Folder created" });
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
    toast({ variant: "success", title: "Success", description: "PDF/Doc Resource added" });
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
      toast({ variant: "success", title: "Success", description: "Images uploaded to gallery" });
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
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-100">Total Students</p>
                      <p className="text-3xl font-bold mt-1">{totalStudents}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-green-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-100">Enabled</p>
                      <p className="text-3xl font-bold mt-1">{enabledStudents}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-red-500 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-100">Pending</p>
                      <p className="text-3xl font-bold mt-1">{disabledStudents}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Student Management Card */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/50 border-b">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      Student Management
                    </CardTitle>
                    <CardDescription className="mt-2">Manage student access and payment status</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                      <Label className="text-sm font-medium">Reg Fee:</Label>
                      <Input type="number" className="w-20 h-8 text-center font-semibold" value={localRegFee} onChange={e => setLocalRegFee(Number(e.target.value))} />
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                      <Label className="text-sm font-medium whitespace-nowrap">QR Code:</Label>
                       <div className="flex items-center gap-2">
                         {qrCodeUrl && (
                           <Dialog>
                             <DialogTrigger asChild>
                               <Button variant="outline" size="sm" className="h-8"><QrCode className="h-4 w-4 mr-1"/> View</Button>
                             </DialogTrigger>
                             <DialogContent>
                               <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-sm mx-auto" />
                             </DialogContent>
                           </Dialog>
                         )}
                         <Input type="file" accept="image/*" className="w-32 h-8 text-xs" onChange={handleQrUpload} />
                       </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name, ID, or mobile..." className="pl-10 bg-white shadow-sm" value={studentListSearch} onChange={e => setStudentListSearch(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[450px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead className="font-semibold">Student ID</TableHead>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Mobile</TableHead>
                        <TableHead className="font-semibold">City/State</TableHead>
                        <TableHead className="font-semibold">Payment</TableHead>
                        <TableHead className="font-semibold">Access</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map(student => (
                        <TableRow key={student.id} className="hover:bg-blue-50/50 transition-colors">
                          <TableCell className="font-mono text-sm bg-slate-50/50">{student.studentId}</TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-muted-foreground">{student.mobile}</TableCell>
                          <TableCell className="text-muted-foreground">{student.city}, {student.state}</TableCell>
                          <TableCell>
                            {student.isPaymentCompleted ? 
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold"><CheckCircle className="h-3.5 w-3.5"/> Paid</span> : 
                              <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-semibold">Pending</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch checked={student.isPaymentCompleted} onCheckedChange={() => handleStudentPaymentToggle(student)} />
                              <span className={cn("text-xs font-medium", student.isPaymentCompleted ? "text-green-600" : "text-gray-400")}>{student.isPaymentCompleted ? 'Active' : 'Inactive'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-red-50" onClick={() => handleDeleteStudent(student.id)}>
                               <Trash2 className="h-4 w-4" />
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredStudents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            No students found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case "upload":
        return (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                <FileUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upload New Test</h2>
                <p className="text-muted-foreground">Create typing or shorthand test content</p>
              </div>
            </div>

            {/* Test Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className={cn(
                  "cursor-pointer transition-all duration-200 border-2",
                  contentType === 'typing' 
                    ? "border-blue-500 bg-blue-50/50 shadow-md" 
                    : "border-transparent hover:border-slate-200 hover:shadow-sm"
                )}
                onClick={() => setContentType('typing')}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    contentType === 'typing' ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    <Keyboard className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={cn("font-semibold", contentType === 'typing' ? "text-blue-700" : "text-gray-700")}>Typing Test</h3>
                    <p className="text-sm text-muted-foreground">Text-based typing assessment</p>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className={cn(
                  "cursor-pointer transition-all duration-200 border-2",
                  contentType === 'shorthand' 
                    ? "border-orange-500 bg-orange-50/50 shadow-md" 
                    : "border-transparent hover:border-slate-200 hover:shadow-sm"
                )}
                onClick={() => setContentType('shorthand')}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    contentType === 'shorthand' ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    <Mic className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className={cn("font-semibold", contentType === 'shorthand' ? "text-orange-700" : "text-gray-700")}>Shorthand Test</h3>
                    <p className="text-sm text-muted-foreground">Audio dictation with transcription</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Form Card */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-green-50/50 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className={cn(
                    "p-2 rounded-lg",
                    contentType === 'typing' ? "bg-blue-100" : "bg-orange-100"
                  )}>
                    {contentType === 'typing' ? (
                      <Keyboard className={cn("h-4 w-4", contentType === 'typing' ? "text-blue-600" : "text-orange-600")} />
                    ) : (
                      <Mic className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                  {contentType === 'typing' ? 'Typing Test Details' : 'Shorthand Test Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleUpload} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Test Title</Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter title" required className="bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Schedule Date</Label>
                      <Input type="date" value={dateFor} onChange={e => setDateFor(e.target.value)} required className="bg-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Language</Label>
                      <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="hindi">Hindi (Mangal)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Duration</Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
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
                  
                  {contentType === 'shorthand' && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Music className="h-5 w-5 text-orange-600" />
                        <Label className="text-sm font-medium text-orange-800">Audio File (Required)</Label>
                      </div>
                      <Input 
                        type="file" 
                        accept="audio/*" 
                        onChange={e => setDictationFile(e.target.files?.[0] || null)} 
                        ref={dictationFileInputRef} 
                        required={contentType === 'shorthand'} 
                        className="bg-white"
                      />
                      {dictationFile && (
                        <p className="mt-2 text-sm text-orange-700 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> {dictationFile.name}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Content Text (Transcript)</Label>
                    <Textarea 
                      value={textContent} 
                      onChange={e => setTextContent(e.target.value)} 
                      placeholder="Paste the text content here..."
                      className={cn(
                        "min-h-[200px] font-mono bg-white border-2 focus:border-primary/50",
                        language === 'hindi' ? "font-mangal" : ""
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      {textContent.split(/\s+/).filter(Boolean).length} words | {textContent.length} characters
                    </p>
                  </div>

                  <div className="flex justify-end pt-4 border-t">
                    <Button 
                      type="submit" 
                      disabled={isUploading}
                      className="bg-gradient-to-r from-green-500 to-green-600 shadow-md hover:shadow-lg transition-all px-8"
                    >
                      {isUploading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="mr-2 h-4 w-4" /> Upload Test</>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        );
      case "manage":
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                <LayoutList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Tests</h2>
                <p className="text-muted-foreground">View, enable/disable, and manage all tests</p>
              </div>
            </div>

            {isContentLoading ? (
              <Card className="shadow-lg border-0">
                <CardContent className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-muted-foreground">Loading tests...</span>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {['typing', 'shorthand'].map(type => {
                  const testCount = content.filter(c => c.type === type).length;
                  const activeCount = content.filter(c => c.type === type && c.isEnabled).length;
                  return (
                    <Card key={type} className="shadow-lg border-0 overflow-hidden">
                      <CardHeader className={cn(
                        "border-b",
                        type === 'typing' ? "bg-gradient-to-r from-blue-50 to-indigo-50" : "bg-gradient-to-r from-orange-50 to-amber-50"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              type === 'typing' ? "bg-blue-100" : "bg-orange-100"
                            )}>
                              {type === 'typing' ? (
                                <Keyboard className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Mic className="h-5 w-5 text-orange-600" />
                              )}
                            </div>
                            <div>
                              <CardTitle className="text-lg capitalize">{type} Tests</CardTitle>
                              <CardDescription>{testCount} tests, {activeCount} active</CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-[300px] overflow-auto">
                          <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                              <TableRow>
                                <TableHead className="font-semibold">Date</TableHead>
                                <TableHead className="font-semibold">Title</TableHead>
                                <TableHead className="font-semibold">Lang</TableHead>
                                <TableHead className="font-semibold">Duration</TableHead>
                                <TableHead className="font-semibold">Status</TableHead>
                                <TableHead className="font-semibold">Preview</TableHead>
                                <TableHead className="font-semibold">Actions</TableHead>
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
                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                  <TableCell className="font-mono text-sm">{format(new Date(item.dateFor), "MMM d")}</TableCell>
                                  <TableCell className="font-medium">{item.title}</TableCell>
                                  <TableCell className="capitalize">{item.language}</TableCell>
                                  <TableCell>{item.duration} min</TableCell>
                                  <TableCell>
                                    {item.isEnabled ? (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Active</span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">Inactive</span>
                                    )}
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
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Switch checked={item.isEnabled} onCheckedChange={() => toggleContent(parseInt(item.id))} />
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => handleDeleteContent(parseInt(item.id))}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {content.filter(c => c.type === type).length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <LayoutList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    No {type} tests yet
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "pdfstore":
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                  <FolderPlus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">PDF Store</h2>
                  <p className="text-muted-foreground">Organize and manage study materials</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">{pdfFolders.length} folders</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">{pdfResources.length} files</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Folders Panel */}
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FolderPlus className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Folders</CardTitle>
                      <CardDescription>Create and manage folders</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="New folder name..." 
                      value={newFolderName} 
                      onChange={e => setNewFolderName(e.target.value)} 
                      className="bg-white"
                    />
                    <Button onClick={handleCreateFolder} className="bg-gradient-to-r from-orange-500 to-orange-600 shrink-0">
                      <FolderPlus className="mr-2 h-4 w-4"/> Create
                    </Button>
                  </div>
                  
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b">
                      <h4 className="text-sm font-semibold text-gray-700">Your Folders</h4>
                    </div>
                    <div className="max-h-[300px] overflow-auto divide-y">
                      {pdfFolders.map(f => (
                        <div 
                          key={f.id} 
                          className={cn(
                            "p-3 flex items-center justify-between cursor-pointer transition-colors",
                            selectedFolderId === parseInt(f.id) 
                              ? "bg-orange-50 border-l-4 border-l-orange-500" 
                              : "hover:bg-slate-50"
                          )}
                          onClick={() => setSelectedFolderId(parseInt(f.id))}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              selectedFolderId === parseInt(f.id) ? "bg-orange-100" : "bg-slate-100"
                            )}>
                              <FolderPlus size={16} className={selectedFolderId === parseInt(f.id) ? "text-orange-600" : "text-slate-500"} />
                            </div>
                            <span className={cn(
                              "font-medium",
                              selectedFolderId === parseInt(f.id) ? "text-orange-700" : "text-gray-700"
                            )}>
                              {f.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-white border rounded-full text-muted-foreground">
                              {pdfResources.filter(p => p.folderId === f.id).length} files
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-destructive hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete folder "${f.name}"? All files inside will also be deleted.`)) {
                                  deletePdfFolder(parseInt(f.id));
                                  if (selectedFolderId === parseInt(f.id)) {
                                    setSelectedFolderId(null);
                                  }
                                  toast({ variant: "success", title: "Deleted", description: "Folder deleted successfully" });
                                }
                              }}
                              data-testid={`button-delete-folder-${f.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {pdfFolders.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                          <FolderPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No folders created yet</p>
                          <p className="text-xs mt-1">Create your first folder above</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Files Panel */}
              <Card className="shadow-lg border-0">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Upload className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Upload Resources</CardTitle>
                      <CardDescription>Add PDF and document files</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {selectedFolderId ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <FolderPlus size={16} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="text-xs text-orange-600 font-medium">Selected Folder</p>
                          <p className="font-semibold text-orange-800">{pdfFolders.find(f => parseInt(f.id) === selectedFolderId)?.name}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Resource Name</Label>
                          <Input value={pdfName} onChange={e => setPdfName(e.target.value)} placeholder="e.g. Chapter 1 Notes" className="bg-white" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Price (₹)</Label>
                            <Input type="number" value={pdfPageCount} onChange={e => setPdfPageCount(e.target.value)} placeholder="e.g. 99" className="bg-white" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">File</Label>
                            <Input type="file" accept=".pdf,.doc,.docx" onChange={e => setPdfFile(e.target.files?.[0] || null)} className="bg-white" />
                          </div>
                        </div>
                      </div>
                      <Button onClick={handleUploadPdf} className="w-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-md">
                        <Upload className="mr-2 h-4 w-4"/> Upload Resource
                      </Button>
                      
                      <div className="border-t pt-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">Files in Folder</h4>
                          <span className="text-xs text-muted-foreground">{pdfResources.filter(p => parseInt(p.folderId) === selectedFolderId).length} items</span>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-auto">
                          {pdfResources.filter(p => parseInt(p.folderId) === selectedFolderId).map(pdf => (
                            <div key={pdf.id} className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg hover:bg-slate-100 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-red-100 rounded-lg shrink-0">
                                  <FileUp size={14} className="text-red-600" />
                                </div>
                                <div className="overflow-hidden">
                                  <p className="font-medium text-sm truncate">{pdf.name}</p>
                                  <p className="text-xs text-muted-foreground">{pdf.pageCount} pages &middot; ₹{pdf.price}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-50 shrink-0" onClick={() => handleDeletePdf(parseInt(pdf.id))}>
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                          {pdfResources.filter(p => parseInt(p.folderId) === selectedFolderId).length === 0 && (
                            <div className="p-6 text-center border-2 border-dashed rounded-lg text-muted-foreground">
                              <FileUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">No files in this folder</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-blue-200 rounded-xl text-muted-foreground bg-blue-50/30">
                      <div className="p-4 bg-blue-100 rounded-full mb-4">
                        <FolderPlus className="h-8 w-8 text-blue-400" />
                      </div>
                      <p className="font-medium text-blue-600">Select a Folder</p>
                      <p className="text-sm mt-1">Choose a folder from the left panel to manage files</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case "results":
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                  <BarChart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Student Results</h2>
                  <p className="text-muted-foreground">View and download performance reports</p>
                </div>
              </div>
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or ID..." className="pl-10 bg-white shadow-sm" value={studentFilter} onChange={e => setStudentFilter(e.target.value)} />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-indigo-100">Total Results</p>
                      <p className="text-3xl font-bold mt-1">{results.length}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <BarChart className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-100">Typing Tests</p>
                      <p className="text-3xl font-bold mt-1">{results.filter(r => r.contentType === 'typing').length}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Keyboard className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-100">Shorthand Tests</p>
                      <p className="text-3xl font-bold mt-1">{results.filter(r => r.contentType === 'shorthand').length}</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Mic className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results Table */}
            <Card className="shadow-lg border-0">
              <CardContent className="p-0">
                <Tabs key="results-tabs" defaultValue="typing" className="w-full">
                  <div className="px-6 pt-4 border-b bg-slate-50">
                    <TabsList className="bg-white shadow-sm">
                      <TabsTrigger value="typing" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                        <Keyboard className="h-4 w-4 mr-2" /> Typing Results
                      </TabsTrigger>
                      <TabsTrigger value="shorthand" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                        <Mic className="h-4 w-4 mr-2" /> Shorthand Results
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {['typing', 'shorthand'].map(type => (
                    <TabsContent key={type} value={type} className="m-0">
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader className="bg-slate-50 sticky top-0">
                            <TableRow>
                              <TableHead className="font-semibold">Student</TableHead>
                              <TableHead className="font-semibold">Test Title</TableHead>
                              <TableHead className="font-semibold">Date</TableHead>
                              <TableHead className="font-semibold">Metrics</TableHead>
                              <TableHead className="font-semibold text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResults
                              .filter(r => r.contentType === type)
                              .map((result) => (
                                <TableRow key={result.id} className="hover:bg-slate-50/50">
                                  <TableCell>
                                    <div className="font-medium">{result.studentName}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{result.studentDisplayId || result.studentId}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-medium">{result.contentTitle}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{result.language}</div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{format(new Date(result.submittedAt), "MMM d, p")}</TableCell>
                                  <TableCell>
                                    <div className="text-sm space-y-1">
                                      {result.contentType === 'typing' ? (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{result.netSpeed} WPM</span>
                                          </div>
                                          <div className="text-xs text-muted-foreground">Mistakes: {result.mistakes}</div>
                                        </>
                                      ) : (
                                        <>
                                          <span className={cn(
                                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                                            result.result === 'Pass' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                          )}>
                                            {result.result}
                                          </span>
                                          <div className="text-xs text-muted-foreground">Mistakes: {result.mistakes}</div>
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
                                            <span className="font-semibold">Duration:</span> {result.time} minutes
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
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                  <BarChart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                  No {type} results found
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
          </div>
        );
      case "gallery":
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg">
                <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Gallery & Candidates</h2>
                <p className="text-muted-foreground">Manage images and showcase top students</p>
              </div>
            </div>

            <Card className="shadow-lg border-0">
              <CardContent className="p-0">
                <Tabs key="gallery-tabs" defaultValue="gallery_images">
                  <div className="px-6 pt-4 border-b bg-slate-50">
                    <TabsList className="bg-white shadow-sm">
                      <TabsTrigger value="gallery_images" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">
                        <ImageIcon className="h-4 w-4 mr-2" /> Gallery Images
                      </TabsTrigger>
                      <TabsTrigger value="selected_candidates" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
                        <Users className="h-4 w-4 mr-2" /> Selected Candidates
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="gallery_images" className="p-6">
                    <div className="space-y-6">
                      <div className="border-2 border-dashed border-pink-200 bg-pink-50/50 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-pink-50 transition-colors cursor-pointer">
                        <div className="p-4 bg-pink-100 rounded-full mb-4">
                          <Upload className="h-8 w-8 text-pink-600" />
                        </div>
                        <Label htmlFor="gallery-upload" className="cursor-pointer">
                          <span className="text-pink-600 font-semibold hover:underline text-lg">Click to upload</span>
                          <p className="text-sm text-muted-foreground mt-2">JPG, JPEG, PNG (Bulk upload supported)</p>
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

                      {galleryImages.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-3">{galleryImages.length} images uploaded</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {galleryImages.map((url, idx) => (
                              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border-2 shadow-sm hover:shadow-md transition-shadow">
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
                      )}
                      
                      {galleryImages.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p>No images uploaded yet</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="selected_candidates" className="p-6">
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                        <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                          <Users className="h-5 w-5" /> Add New Candidate
                        </h3>
                        <form onSubmit={handleAddCandidate}>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Name</Label>
                              <Input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Student Name" required className="bg-white" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Designation</Label>
                              <Input value={candidateDesignation} onChange={e => setCandidateDesignation(e.target.value)} placeholder="e.g. Stenographer" required className="bg-white" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Batch Year</Label>
                              <Input value={candidateYear} onChange={e => setCandidateYear(e.target.value)} placeholder="e.g. 2024" required className="bg-white" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Photo</Label>
                              <Input type="file" accept="image/*" onChange={e => setCandidateImage(e.target.files?.[0] || null)} required className="bg-white" />
                            </div>
                            <Button type="submit" className="bg-gradient-to-r from-purple-500 to-purple-600">
                              <Users className="mr-2 h-4 w-4"/> Add
                            </Button>
                          </div>
                        </form>
                      </div>

                      <div className="rounded-xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead className="font-semibold">Photo</TableHead>
                              <TableHead className="font-semibold">Name</TableHead>
                              <TableHead className="font-semibold">Designation</TableHead>
                              <TableHead className="font-semibold">Year</TableHead>
                              <TableHead className="font-semibold text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedCandidates.map((candidate) => (
                              <TableRow key={candidate.id} className="hover:bg-slate-50/50">
                                <TableCell>
                                  <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-purple-200 shadow-sm">
                                    <img src={candidate.imageUrl} alt={candidate.name} className="h-full w-full object-cover" />
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">{candidate.name}</TableCell>
                                <TableCell className="text-muted-foreground">{candidate.designation}</TableCell>
                                <TableCell>
                                  <span className="inline-flex items-center px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                    {candidate.year}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-red-50" onClick={() => removeSelectedCandidate(candidate.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {selectedCandidates.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                  No candidates added yet
                                </TableCell>
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
          </div>
        );
      default:
        return null;
    }
  };

  const menuItems = [
    { id: "students", label: "Students", icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { id: "upload", label: "Upload Tests", icon: FileUp, color: "text-green-600", bg: "bg-green-100" },
    { id: "manage", label: "Manage Tests", icon: LayoutList, color: "text-purple-600", bg: "bg-purple-100" },
    { id: "pdfstore", label: "PDF Store", icon: FolderPlus, color: "text-orange-600", bg: "bg-orange-100" },
    { id: "results", label: "Results", icon: BarChart, color: "text-indigo-600", bg: "bg-indigo-100" },
    { id: "gallery", label: "Gallery", icon: ImageIcon, color: "text-pink-600", bg: "bg-pink-100" },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="w-72 border-r bg-gradient-to-b from-slate-50 to-white flex flex-col shrink-0 overflow-y-auto">
        <div className="p-5 border-b bg-gradient-to-r from-blue-700 to-indigo-600">
          <h2 className="text-xl font-bold text-white drop-shadow-sm">Admin Panel</h2>
          <p className="text-sm text-blue-100 mt-1">Manage your institute</p>
        </div>
        <div className="p-3 space-y-1 flex-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</p>
          {menuItems.map(item => (
            <button
              key={item.id}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left",
                activeTab === item.id 
                  ? "bg-white shadow-md border border-slate-200" 
                  : "hover:bg-white/60"
              )}
              onClick={() => setActiveTab(item.id)}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                activeTab === item.id ? item.bg : "bg-slate-100"
              )}>
                <item.icon size={18} className={activeTab === item.id ? item.color : "text-slate-500"} />
              </div>
              <span className={cn(
                "font-medium text-sm",
                activeTab === item.id ? "text-gray-900" : "text-gray-600"
              )}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t bg-slate-50/50">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Admin</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto bg-gradient-to-br from-slate-50 to-blue-50/30">
        {renderContent()}
      </main>
    </div>
  );
}