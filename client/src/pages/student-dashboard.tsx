import { useState } from "react";
import { useMockStore, Result } from "@/lib/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format, isSameDay } from "date-fns";
import { PlayCircle, CheckCircle, Download, FileText, ShoppingCart, Folder, ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StudentDashboard() {
  const { content, results, currentUser, pdfFolders, pdfResources, buyPdf } = useMockStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const today = new Date();
  
  // PDF Store State
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [processingPdf, setProcessingPdf] = useState<string | null>(null);

  // Filter content: Enabled AND Date is Today
  const todaysTests = content.filter(c => {
    const contentDate = new Date(c.dateFor);
    const isToday = isSameDay(contentDate, today);
    return c.isEnabled && isToday;
  });

  const getResultForContent = (contentId: string) => {
    return results.find(r => r.contentId === contentId && r.studentId === currentUser?.id);
  };

  const handleDownloadResult = (result: Result) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Pragati Shorthand and Typing", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Student Report: ${result.studentName} (${result.studentId})`, 14, 25);
    doc.text(`Test: ${result.contentTitle} (${result.contentType.toUpperCase()})`, 14, 32);
    doc.text(`Language: ${result.language?.toUpperCase() || 'ENGLISH'}`, 14, 39);
    doc.text(`Date: ${format(new Date(result.submittedAt), "PPP p")}`, 14, 46);

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
        startY: 52,
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
        startY: 52,
        head: [['Metric', 'Value']],
        body: data.slice(1),
      });
    }

    // Add Typed Content snippet
    const finalY = (doc as any).lastAutoTable.finalY || 52;
    doc.text("Original Content:", 14, finalY + 10);
    const splitOriginal = doc.splitTextToSize(result.originalText || "", 180);
    doc.text(splitOriginal, 14, finalY + 17);
    
    const secondY = finalY + 17 + (splitOriginal.length * 5);
    doc.text("Typed Content:", 14, secondY + 10);
    const splitTyped = doc.splitTextToSize(result.typedText, 180);
    doc.text(splitTyped, 14, secondY + 17);

    doc.save(`result_${result.studentId}_${result.id}.pdf`);
  };

  const handleBuyPdf = async (pdfId: string, price: number) => {
    setProcessingPdf(pdfId);
    // Mock payment gateway delay
    await new Promise(r => setTimeout(r, 1500));
    
    // In real app, here we would trigger payment gateway
    // For now, assume success
    buyPdf(pdfId);
    setProcessingPdf(null);
    toast({
      title: "Purchase Successful",
      description: `You have successfully purchased this PDF for ₹${price}.`
    });
  };

  const handleDownloadPdf = (pdfUrl: string) => {
    // In mockup, we can't really download external mock URLs, so we simulate
    toast({ title: "Downloading...", description: "Your PDF download has started." });
    // Simulate link click
    // const link = document.createElement('a');
    // link.href = pdfUrl;
    // link.download = 'resource.pdf';
    // link.click();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {currentUser?.name}</p>
      </div>

      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="results">My Results</TabsTrigger>
          <TabsTrigger value="store">PDF Store</TabsTrigger>
        </TabsList>

        <TabsContent value="tests">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {todaysTests.length > 0 ? (
              todaysTests.map((test) => {
                const result = getResultForContent(test.id);
                const isCompleted = !!result;

                return (
                  <Card key={test.id} className="flex flex-col border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-xl">{test.title}</CardTitle>
                      <CardDescription className="capitalize font-medium text-primary flex justify-between">
                        <span>{test.type} Test</span>
                        <span>{test.language || 'English'}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Duration: <span className="font-semibold text-foreground">{test.duration} Minutes</span></p>
                        {test.type === 'shorthand' && (
                          <p className="text-orange-600 bg-orange-50 inline-block px-2 py-1 rounded-sm text-xs">
                            Requires Hard Copy
                          </p>
                        )}
                        {test.mediaUrl && (
                          <p className="text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded-sm text-xs ml-2">
                            Audio Available
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t bg-muted/20">
                      {isCompleted ? (
                        <Button variant="outline" className="w-full cursor-default bg-green-50 hover:bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="mr-2 h-4 w-4" /> Completed
                        </Button>
                      ) : (
                        <Button 
                          className="w-full" 
                          onClick={() => setLocation(`/test/${test.id}`)}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No tests available for today</h3>
                <p className="text-muted-foreground mt-2">Please check back later or contact your administrator.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results">
           <div className="space-y-4">
            {results
              .filter(r => r.studentId === currentUser?.studentId || r.studentId === currentUser?.id)
              .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
              .map(result => (
                <Card key={result.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{result.contentTitle}</h4>
                    <p className="text-sm text-muted-foreground">{format(new Date(result.submittedAt), "PPP p")}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    {result.contentType === 'typing' ? (
                       <div className="text-sm">
                         <span className="font-bold text-primary">{result.metrics.netSpeed} WPM</span>
                         <span className="mx-2 text-muted-foreground">|</span>
                         <span className="text-muted-foreground">{result.metrics.mistakes} Mistakes</span>
                       </div>
                    ) : (
                      <div className="text-sm">
                        <span className={result.metrics.result === 'Pass' ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                          {result.metrics.result}
                        </span>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">{result.metrics.mistakes} Mistakes</span>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDownloadResult(result)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
             {results.filter(r => r.studentId === currentUser?.studentId || r.studentId === currentUser?.id).length === 0 && (
               <p className="text-muted-foreground text-center py-8">No history yet.</p>
             )}
          </div>
        </TabsContent>

        <TabsContent value="store">
          <Card>
            <CardHeader>
               <div className="flex items-center gap-2">
                 {currentFolder && (
                   <Button variant="ghost" size="icon" onClick={() => setCurrentFolder(null)}>
                     <ArrowLeft className="h-4 w-4" />
                   </Button>
                 )}
                 <CardTitle>{currentFolder ? pdfFolders.find(f => f.id === currentFolder)?.name : "PDF Store"}</CardTitle>
               </div>
               <CardDescription>
                 {currentFolder ? "Browse and purchase study materials." : "Select a folder to browse PDFs."}
               </CardDescription>
            </CardHeader>
            <CardContent>
              {!currentFolder ? (
                // Folder View
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pdfFolders.map(folder => (
                    <div 
                      key={folder.id} 
                      onClick={() => setCurrentFolder(folder.id)}
                      className="cursor-pointer border rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Folder className="h-12 w-12 text-blue-500 fill-blue-100" />
                      <span className="font-medium text-center">{folder.name}</span>
                    </div>
                  ))}
                  {pdfFolders.length === 0 && <p className="col-span-full text-center text-muted-foreground">No folders available.</p>}
                </div>
              ) : (
                // PDF List View
                <div className="space-y-4">
                  {pdfResources.filter(p => p.folderId === currentFolder).map(pdf => {
                     const isPurchased = currentUser?.purchasedPdfs?.includes(pdf.id);
                     
                     return (
                       <div key={pdf.id} className="flex items-center justify-between p-4 border rounded-lg">
                         <div className="flex items-center gap-3">
                           <FileText className="h-8 w-8 text-red-500" />
                           <div>
                             <h4 className="font-medium">{pdf.name}</h4>
                             <p className="text-xs text-muted-foreground">{pdf.pageCount} Pages</p>
                           </div>
                         </div>
                         
                         <div>
                           {isPurchased ? (
                              <Button variant="outline" className="text-green-600 border-green-200 bg-green-50" onClick={() => handleDownloadPdf(pdf.url)}>
                                <Download className="mr-2 h-4 w-4" /> Download
                              </Button>
                           ) : (
                             <Button onClick={() => handleBuyPdf(pdf.id, pdf.price)} disabled={processingPdf === pdf.id}>
                               {processingPdf === pdf.id ? (
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                               ) : (
                                 <ShoppingCart className="mr-2 h-4 w-4" />
                               )}
                               Buy for ₹{pdf.price}
                             </Button>
                           )}
                         </div>
                       </div>
                     );
                  })}
                   {pdfResources.filter(p => p.folderId === currentFolder).length === 0 && (
                     <p className="text-center text-muted-foreground">No PDFs in this folder.</p>
                   )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
