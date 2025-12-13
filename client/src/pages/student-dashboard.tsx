import { useState } from "react";
import { useMockStore, Result } from "@/lib/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format, isSameDay } from "date-fns";
import { PlayCircle, CheckCircle, Download, FileText, ShoppingCart, Folder, ArrowLeft, Loader2, Mic, CreditCard, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StudentDashboard() {
  const { content, results, currentUser, pdfFolders, pdfResources, buyPdf, consumePdfPurchase, qrCodeUrl, dictations } = useMockStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const today = new Date();
  
  // PDF Store State
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [processingPdf, setProcessingPdf] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPdfForPurchase, setSelectedPdfForPurchase] = useState<{id: string, price: number} | null>(null);
  
  // Payment Gateway State
  const [paymentTab, setPaymentTab] = useState("qr");
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Filter content: Enabled AND Date is Today
  const todaysTests = content.filter(c => {
    const contentDate = new Date(c.dateFor);
    const isToday = isSameDay(contentDate, today);
    return c.isEnabled;
  });

  const getResultForContent = (contentId: string) => {
    return results.find(r => r.contentId === contentId && r.studentId === currentUser?.id);
  };

  const handleDownloadResult = async (result: Result) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("Pragati Shorthand and Typing", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Student Report: ${result.studentName} (${result.studentId})`, 14, 25);
    doc.text(`Test: ${result.contentTitle} (${result.contentType.toUpperCase()})`, 14, 32);
    doc.text(`Language: ${result.language?.toUpperCase() || 'ENGLISH'}`, 14, 39);
    doc.text(`Date: ${format(new Date(result.submittedAt), "PPP p")}`, 14, 46);

    // Metrics Table
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

    // Prepare temporary HTML for rendering complex text/Hindi
    const finalY = (doc as any).lastAutoTable.finalY || 52;
    
    // Create a temporary container for rendering
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '595px'; // A4 width in px approx (at 72dpi, but we scale)
    tempDiv.style.padding = '20px';
    tempDiv.style.fontFamily = result.language === 'hindi' ? '"Mangal", "Tiro Devanagari Hindi", sans-serif' : 'sans-serif';
    tempDiv.style.fontSize = '12px';
    tempDiv.style.color = 'black';
    tempDiv.style.background = 'white';
    
    // Construct HTML content with highlighting
    const originalWords = (result.originalText || "").trim().split(/\s+/);
    const typedWords = result.typedText.trim().split(/\s+/);
    const maxLength = Math.max(originalWords.length, typedWords.length);
    
    let comparisonHtml = `<h3 style="margin-bottom: 10px; font-weight: bold;">Detailed Analysis</h3><div style="display: flex; flex-direction: column; gap: 5px;">`;
    
    // Add header row
    comparisonHtml += `
      <div style="display: flex; border-bottom: 1px solid #ccc; font-weight: bold; padding-bottom: 5px;">
        <div style="flex: 1; padding-right: 10px;">Original Text</div>
        <div style="flex: 1;">Typed Comparison</div>
      </div>
    `;

    for (let i = 0; i < maxLength; i++) {
      const orig = originalWords[i] || "";
      const type = typedWords[i] || "";
      let style = "";
      let typeContent = type;
      
      const isMatch = orig === type;
      
      if (!isMatch) {
        style = "color: red; font-weight: bold;";
        if (!orig && type) {
          typeContent = `<span style="color: red;">${type} (Extra)</span>`;
        } else if (orig && !type) {
           typeContent = `<span style="color: red; font-style: italic;">[Missing]</span>`;
        } else {
           typeContent = `<span style="color: red;">${type}</span>`;
        }
      }

      comparisonHtml += `
        <div style="display: flex; border-bottom: 1px dashed #eee; padding: 4px 0;">
          <div style="flex: 1; padding-right: 10px;">${orig}</div>
          <div style="flex: 1;">${typeContent}</div>
        </div>
      `;
    }
    comparisonHtml += `</div>`;
    
    tempDiv.innerHTML = comparisonHtml;
    document.body.appendChild(tempDiv);
    
    try {
      const canvas = await html2canvas(tempDiv, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth() - 28;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Add a new page if content is too long
      if (finalY + pdfHeight + 10 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        doc.addImage(imgData, 'PNG', 14, 15, pdfWidth, pdfHeight);
      } else {
        doc.addImage(imgData, 'PNG', 14, finalY + 10, pdfWidth, pdfHeight);
      }
      
      doc.save(`result_${result.studentId}_${result.id}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error", err);
      toast({ variant: "destructive", title: "PDF Error", description: "Failed to generate detailed PDF." });
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const initiateBuyPdf = (pdfId: string, price: number) => {
    setSelectedPdfForPurchase({ id: pdfId, price });
    setShowPaymentModal(true);
    setPaymentTab("qr"); // Reset to default
  };

  const confirmPurchase = async () => {
    if (!selectedPdfForPurchase) return;
    
    setIsVerifyingPayment(true);
    
    // Mock payment gateway delay
    await new Promise(r => setTimeout(r, 2000));
    
    buyPdf(selectedPdfForPurchase.id);
    setProcessingPdf(null);
    setSelectedPdfForPurchase(null);
    setShowPaymentModal(false);
    setIsVerifyingPayment(false);
    
    toast({
      title: "Payment Successful",
      description: `Payment verified. You can now download the file.`
    });
  };

  const handleDownloadPdf = (pdfId: string, pdfUrl: string) => {
    toast({ title: "Downloading...", description: "Your PDF download has started." });
    
    // Create temporary link to trigger download
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `resource_${pdfId}.pdf`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revert to Pay button (consume purchase)
    consumePdfPurchase(pdfId);
  };

  console.log("todaysTests****", todaysTests)

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {currentUser?.name}</p>
      </div>

      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="tests">Tests</TabsTrigger>
          <TabsTrigger value="dictation">Dictation</TabsTrigger>
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

        <TabsContent value="dictation">
           <Card>
             <CardHeader>
               <CardTitle>Dictation Practice</CardTitle>
               <CardDescription>Audio resources for shorthand practice.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 {dictations.filter(d => d.isEnabled).map(d => (
                   <div key={d.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                     <div className="flex items-center gap-3">
                       <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                         <Mic size={20} />
                       </div>
                       <div>
                         <h4 className="font-medium">{d.title}</h4>
                         <p className="text-xs text-muted-foreground">Added on {format(new Date(d.createdAt), "MMM d, yyyy")}</p>
                         <p className="text-xs text-blue-600 capitalize">{d.language || 'english'}</p>
                       </div>
                     </div>
                     <div>
                       <audio controls src={d.mediaUrl} className="h-10 w-64" controlsList="nodownload" />
                     </div>
                   </div>
                 ))}
                 {dictations.filter(d => d.isEnabled).length === 0 && (
                   <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                     No active dictation audio files available.
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="results">
           <Tabs defaultValue="typing_results" className="w-full">
             <TabsList className="mb-4">
               <TabsTrigger value="typing_results">Typing Results</TabsTrigger>
               <TabsTrigger value="shorthand_results">Shorthand Results</TabsTrigger>
             </TabsList>
             
             {['typing', 'shorthand'].map(type => (
               <TabsContent key={type} value={`${type}_results`}>
                 <div className="space-y-4">
                  {results
                    .filter(r => (r.studentId === currentUser?.studentId || r.studentId === currentUser?.id) && r.contentType === type)
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
                   {results.filter(r => (r.studentId === currentUser?.studentId || r.studentId === currentUser?.id) && r.contentType === type).length === 0 && (
                     <p className="text-muted-foreground text-center py-8">No {type} history yet.</p>
                   )}
                </div>
               </TabsContent>
             ))}
           </Tabs>
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
                              <Button variant="outline" className="text-green-600 border-green-200 bg-green-50" onClick={() => handleDownloadPdf(pdf.id, pdf.url)}>
                                <Download className="mr-2 h-4 w-4" /> Download
                              </Button>
                           ) : (
                             <Button onClick={() => initiateBuyPdf(pdf.id, pdf.price)} disabled={processingPdf === pdf.id}>
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

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Secure Payment Gateway</DialogTitle>
            <DialogDescription>Complete your purchase of ₹{selectedPdfForPurchase?.price}</DialogDescription>
          </DialogHeader>
          
          <Tabs value={paymentTab} onValueChange={setPaymentTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="qr" className="flex items-center gap-2"><QrCode size={16}/> UPI QR Code</TabsTrigger>
              <TabsTrigger value="card" className="flex items-center gap-2"><CreditCard size={16}/> Debit Card</TabsTrigger>
            </TabsList>
            
            <TabsContent value="qr" className="flex flex-col items-center py-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
                 {/* Auto-generated QR Code for UPI */}
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=pragati@upi&pn=PragatiInstitute&am=${selectedPdfForPurchase?.price}&cu=INR`} 
                   alt="Payment QR" 
                   className="w-48 h-48 object-contain" 
                 />
              </div>
              <p className="text-sm font-medium text-center mb-1">Scan to Pay ₹{selectedPdfForPurchase?.price}</p>
              <p className="text-xs text-muted-foreground text-center">Use any UPI App (GPay, PhonePe, Paytm)</p>
            </TabsContent>
            
            <TabsContent value="card" className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label>CVV</Label>
                  <Input placeholder="123" type="password" maxLength={3} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cardholder Name</Label>
                <Input placeholder="Name on card" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="sm:justify-between flex-row items-center gap-4 mt-4">
            <div className="text-xs text-muted-foreground flex-1">
              Secured by SSL Encryption
            </div>
            <Button onClick={confirmPurchase} disabled={isVerifyingPayment} className="w-full sm:w-auto">
              {isVerifyingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                `Pay ₹${selectedPdfForPurchase?.price}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}