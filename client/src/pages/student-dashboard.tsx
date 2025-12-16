import { useState } from "react";
import {
  useAuth,
  useContent,
  useResults,
  usePdf,
  useSettings,
  useDictations,
} from "@/lib/hooks";
import type { Result } from "@shared/schema";
import { generateResultPDF } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format, isSameDay } from "date-fns";
import {
  PlayCircle,
  CheckCircle,
  Download,
  FileText,
  ShoppingCart,
  Folder,
  ArrowLeft,
  Loader2,
  Mic,
  CreditCard,
  QrCode,
  Eye,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResultTextAnalysis } from "@/components/ResultTextAnalysis";

export default function StudentDashboard() {
  const { user: currentUser } = useAuth();
  const { enabledContent: content } = useContent();
  const { results } = useResults(currentUser?.id);
  const {
    folders: pdfFolders,
    resources: pdfResources,
    purchasePdf: buyPdf,
  } = usePdf();
  const { settings } = useSettings();
  const { dictations } = useDictations();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const qrCodeUrl = settings?.qrCodeUrl || "";

  const today = new Date();

  // PDF Store State
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [processingPdf, setProcessingPdf] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPdfForPurchase, setSelectedPdfForPurchase] = useState<{
    id: string;
    price: number;
  } | null>(null);

  // Payment Gateway State
  const [paymentTab, setPaymentTab] = useState("qr");
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Filter content: Enabled (Date filter removed as requested)
  const availableTests = content.filter((c) => c.isEnabled);

  const typingTests = availableTests.filter((c) => c.type === "typing");
  const shorthandTests = availableTests.filter((c) => c.type === "shorthand");

  const getResultForContent = (contentId: string) => {
    return results.find(
      (r) => r.contentId === contentId && r.studentId === currentUser?.id,
    );
  };

  const handleDownloadResult = (result: Result) => {
    try {
      generateResultPDF(result);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "There was an error generating your result PDF.",
      });
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
    await new Promise((r) => setTimeout(r, 2000));

    buyPdf(selectedPdfForPurchase.id);
    setProcessingPdf(null);
    setSelectedPdfForPurchase(null);
    setShowPaymentModal(false);
    setIsVerifyingPayment(false);

    toast({
      title: "Payment Successful",
      description: `Payment verified. You can now download the file.`,
    });
  };

  const handleDownloadPdf = (pdfId: string, pdfUrl: string) => {
    toast({
      title: "Downloading...",
      description: "Your PDF download has started.",
    });

    // Create temporary link to trigger download
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `resource_${pdfId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revert to Pay button (consume purchase)
    consumePdfPurchase(pdfId);
  };

  console.log("availableTests****", availableTests);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {currentUser?.name}
        </p>
      </div>

      <Tabs defaultValue="typing_tests" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-300">
          <TabsTrigger
            value="typing_tests"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-foreground border-r last:border-r-0"
          >
            Typing Tests
          </TabsTrigger>
          <TabsTrigger
            value="shorthand_tests"
            className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-foreground border-r last:border-r-0"
          >
            Shorthand Tests
          </TabsTrigger>
          <TabsTrigger
            value="results"
            className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-foreground border-r last:border-r-0"
          >
            My Results
          </TabsTrigger>
          <TabsTrigger
            value="store"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-foreground"
          >
            PDF Store
          </TabsTrigger>
        </TabsList>

        <TabsContent value="typing_tests">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {typingTests.length > 0 ? (
              typingTests.map((test) => {
                const result = getResultForContent(test.id);
                const isCompleted = !!result;

                return (
                  <Card
                    key={test.id}
                    className="flex flex-col border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{test.title}</CardTitle>
                      <CardDescription className="capitalize font-medium text-primary flex justify-between">
                        <span>Typing Test</span>
                        <span>{test.language || "English"}</span>
                      </CardDescription>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(test.dateFor), "PPP")}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          Duration:{" "}
                          <span className="font-semibold text-foreground">
                            {test.duration} Minutes
                          </span>
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t bg-muted/20">
                      <Button
                        className="w-full"
                        onClick={() => setLocation(`/test/${test.id}`)}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">
                  No typing tests available
                </h3>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="shorthand_tests">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shorthandTests.length > 0 ? (
              shorthandTests.map((test) => {
                const result = getResultForContent(test.id);
                const isCompleted = !!result;

                return (
                  <Card
                    key={test.id}
                    className="flex flex-col border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{test.title}</CardTitle>
                      <CardDescription className="capitalize font-medium text-orange-600 flex justify-between">
                        <span>Shorthand Test</span>
                        <span>{test.language || "English"}</span>
                      </CardDescription>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(test.dateFor), "PPP")}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          Duration:{" "}
                          <span className="font-semibold text-foreground">
                            {test.duration} Minutes
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Workflow: Listen to Audio → Write on Paper → Type Here
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t bg-muted/20">
                      {isCompleted ? (
                        <div className="w-full flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 cursor-default bg-green-50 text-green-700 border-green-200"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> Completed
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDownloadResult(result)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="w-full bg-orange-300"
                          variant="secondary"
                          onClick={() => setLocation(`/test/${test.id}`)}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" /> Start
                          Shorthand Test
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
                <div className="bg-muted rounded-full p-4 mb-4">
                  <Mic className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">
                  No shorthand tests available
                </h3>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results">
          <Tabs defaultValue="typing_results" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="typing_results">Typing Results</TabsTrigger>
              <TabsTrigger value="shorthand_results">
                Shorthand Results
              </TabsTrigger>
            </TabsList>

            {["typing", "shorthand"].map((type) => (
              <TabsContent key={type} value={`${type}_results`}>
                <div className="space-y-4">
                  {results
                    .filter(
                      (r) =>
                        (r.studentId === currentUser?.studentId ||
                          r.studentId === currentUser?.id) &&
                        r.contentType === type,
                    )
                    .sort(
                      (a, b) =>
                        new Date(b.submittedAt).getTime() -
                        new Date(a.submittedAt).getTime(),
                    )
                    .map((result) => (
                      <Card
                        key={result.id}
                        className="p-4 flex items-center justify-between"
                      >
                        <div>
                          <h4 className="font-semibold">
                            {result.contentTitle}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(result.submittedAt), "PPP p")}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-4">
                          {result.contentType === "typing" ? (
                            <div className="text-sm">
                              <span className="font-bold text-primary">
                                {result.netSpeed} WPM
                              </span>
                              <span className="mx-2 text-muted-foreground">
                                |
                              </span>
                              <span className="text-muted-foreground">
                                {result.mistakes} Mistakes
                              </span>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <span
                                className={
                                  result.result === "Pass"
                                    ? "text-green-600 font-bold"
                                    : "text-red-600 font-bold"
                                }
                              >
                                {result.result}
                              </span>
                              <span className="mx-2 text-muted-foreground">
                                |
                              </span>
                              <span className="text-muted-foreground">
                                {result.mistakes} Mistakes
                              </span>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadResult(result)}
                            >
                              <Download className="h-4 w-4 mr-1" /> PDF
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
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
                                      <span className="font-semibold">
                                        Test:
                                      </span>{" "}
                                      {result.contentTitle}
                                    </div>
                                    <div>
                                      <span className="font-semibold">
                                        Date:
                                      </span>{" "}
                                      {format(
                                        new Date(result.submittedAt),
                                        "PPP",
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-semibold">
                                        Mistakes:
                                      </span>{" "}
                                      <span className="text-red-600 font-bold">
                                        {result.mistakes}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-semibold">
                                        Total Original Words:
                                      </span>{" "}
                                      <span>
                                        {
                                          (result.originalText || "")
                                            .trim()
                                            .split(/\s+/).length
                                        }
                                      </span>
                                    </div>
                                    <div>
                                      {result.contentType === "typing" ? (
                                        <span>
                                          <span className="font-semibold">
                                            Net Speed:
                                          </span>{" "}
                                          {result.netSpeed} WPM
                                        </span>
                                      ) : (
                                        <span>
                                          <span className="font-semibold">
                                            Result:
                                          </span>{" "}
                                          <span
                                            className={
                                              result.result === "Pass"
                                                ? "text-green-600 font-bold"
                                                : "text-red-600 font-bold"
                                            }
                                          >
                                            {" "}
                                            {result.result}
                                          </span>{" "}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="border rounded p-4 bg-muted/30">
                                    <h4 className="font-semibold mb-2">
                                      Your Input
                                    </h4>
                                    <ResultTextAnalysis
                                      originalText={result.originalText || ""}
                                      typedText={result.typedText}
                                      language={result.language}
                                    />
                                  </div>

                                  <div className="border rounded p-4 bg-muted/30">
                                    <h4 className="font-semibold mb-2">
                                      Original Text
                                    </h4>
                                    <p className="text-sm whitespace-pre-wrap">
                                      {result.originalText}
                                    </p>
                                  </div>

                                  <div className="flex justify-end pt-4">
                                    <Button
                                      onClick={() =>
                                        handleDownloadResult(result)
                                      }
                                    >
                                      <Download className="mr-2 h-4 w-4" />{" "}
                                      Download PDF Report
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </Card>
                    ))}
                  {results.filter(
                    (r) =>
                      (r.studentId === currentUser?.studentId ||
                        r.studentId === currentUser?.id) &&
                      r.contentType === type,
                  ).length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No {type} history yet.
                    </p>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFolder(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <CardTitle>
                  {currentFolder
                    ? pdfFolders.find((f) => f.id === currentFolder)?.name
                    : "PDF Store"}
                </CardTitle>
              </div>
              <CardDescription>
                {currentFolder
                  ? "Browse and purchase study materials."
                  : "Select a folder to browse PDFs."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!currentFolder ? (
                // Folder View
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pdfFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolder(folder.id)}
                      className="cursor-pointer border rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Folder className="h-12 w-12 text-blue-500 fill-blue-100" />
                      <span className="font-medium text-center">
                        {folder.name}
                      </span>
                    </div>
                  ))}
                  {pdfFolders.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground">
                      No folders available.
                    </p>
                  )}
                </div>
              ) : (
                // PDF List View
                <div className="space-y-4">
                  {pdfResources
                    .filter((p) => p.folderId === currentFolder)
                    .map((pdf) => {
                      const isPurchased = currentUser?.purchasedPdfs?.includes(
                        pdf.id,
                      );

                      return (
                        <div
                          key={pdf.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-red-500" />
                            <div>
                              <h4 className="font-medium">{pdf.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {pdf.pageCount} Pages
                              </p>
                            </div>
                          </div>

                          <div>
                            {isPurchased ? (
                              <Button
                                variant="outline"
                                className="text-green-600 border-green-200 bg-green-50"
                                onClick={() =>
                                  handleDownloadPdf(pdf.id, pdf.url)
                                }
                              >
                                <Download className="mr-2 h-4 w-4" /> Download
                              </Button>
                            ) : (
                              <Button
                                onClick={() =>
                                  initiateBuyPdf(pdf.id, pdf.price)
                                }
                                disabled={processingPdf === pdf.id}
                              >
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
                  {pdfResources.filter((p) => p.folderId === currentFolder)
                    .length === 0 && (
                    <p className="text-center text-muted-foreground">
                      No PDFs in this folder.
                    </p>
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
            <DialogDescription>
              Complete your purchase of ₹{selectedPdfForPurchase?.price}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={paymentTab}
            onValueChange={setPaymentTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="qr" className="flex items-center gap-2">
                <QrCode size={16} /> UPI QR Code
              </TabsTrigger>
              <TabsTrigger value="card" className="flex items-center gap-2">
                <CreditCard size={16} /> Debit Card
              </TabsTrigger>
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
              <p className="text-sm font-medium text-center mb-1">
                Scan to Pay ₹{selectedPdfForPurchase?.price}
              </p>
              <p className="text-xs text-muted-foreground text-center">
                Use any UPI App (GPay, PhonePe, Paytm)
              </p>
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
            <Button
              onClick={confirmPurchase}
              disabled={isVerifyingPayment}
              className="w-full sm:w-auto"
            >
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
