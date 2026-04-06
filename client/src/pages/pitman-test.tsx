import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateShorthandMetrics, cn, stripHtml, replaceNewlinesWithParaToken, PARA_TOKEN } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Save, CheckCircle, ArrowLeft, Maximize, Minimize, Type, RefreshCw, Loader2, AlertCircle, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

export default function PitmanTestPage() {
  const [, params] = useRoute("/test/:id");
  const { user: currentUser } = useAuth();
  const { data: testContent, isLoading: isContentLoading } = useContentById(params?.id ? Number(params.id) : undefined);
  const { createResult } = useResults(undefined, false);
  const { toast } = useToast();
  
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [backspaces, setBackspaceCount] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);
  
  // Timer References
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
      // Generate blob URL from pdfFile (base64 encoded PDF)
      console.log("Processing test content - ID:", testContent.id, "PDF field exists:", !!testContent.pdfFile);
      if (testContent.pdfFile && testContent.pdfFile.trim().length > 0) {
        try {
          // Convert base64 to Blob
          let binaryString: string;
          if (testContent.pdfFile.startsWith('data:')) {
            // Extract base64 from data URL
            const base64 = testContent.pdfFile.split(',')[1] || testContent.pdfFile;
            binaryString = atob(base64);
          } else {
            binaryString = atob(testContent.pdfFile);
          }
          
          // Convert binary string to bytes
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Create Blob and blob URL
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(blob);
          
          setPdfUrl(blobUrl);
          console.log("PDF loaded successfully for test:", testContent.id, "Size:", testContent.pdfFile.length, "bytes, Blob URL created");
        } catch (error) {
          console.error("Error processing PDF:", error);
          setPdfUrl("");
        }
      } else {
        console.warn("No PDF file found or empty for test:", testContent.id);
        console.log("Test content object:", JSON.stringify(testContent, null, 2));
        setPdfUrl("");
      }
    }
  }, [testContent]);

  // Cooldown check
  useEffect(() => {
    if (!testContent || !currentUser) return;
    
    const cooldownKey = `test_cooldown_${testContent.id}_${currentUser.id}`;
    const checkCooldown = () => {
      const cooldownEnd = localStorage.getItem(cooldownKey);
      if (cooldownEnd) {
        const endTime = parseInt(cooldownEnd, 10);
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          localStorage.removeItem(cooldownKey);
          setCooldownRemaining(0);
          return false;
        }
        setCooldownRemaining(remaining);
        return true;
      }
      setCooldownRemaining(0);
      return false;
    };
    
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, [testContent, currentUser]);

  const handleSubmit = useCallback(async () => {
    console.log("handleSubmit called", { testContent, currentUser });
    
    if (!testContent) {
      console.error("No test content available");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Test content not found.",
      });
      return;
    }
    
    if (!currentUser) {
      console.error("No current user - session may have expired");
      toast({
        variant: "destructive",
        title: "Session Expired",
        description: "Please log in again to submit your test.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionFailed(false);

    let metrics;
    let result: 'Pass' | 'Fail';

    // Process typed text the same way as shorthand tests - replace newlines with paragraph token
    const storedTypedText = replaceNewlinesWithParaToken(typedText);
    
    // Strip HTML from test content and PARA_TOKEN from both texts for metrics calculation only
    const cleanTestText = stripHtml(testContent.text).replace(new RegExp(PARA_TOKEN, 'g'), '');
    const cleanTypedText = storedTypedText.replace(new RegExp(PARA_TOKEN, 'g'), '');

    // For Pitman tests, use shorthand metrics calculation
    metrics = calculateShorthandMetrics(cleanTestText, cleanTypedText, testContent.duration);
    result = metrics.result;

    try {
      await createResult({
        contentId: testContent.id,
        typedText: storedTypedText,
        words: metrics.words,
        time: testContent.duration,
        mistakes: String(metrics.mistakes),
        halfMistakes: String(metrics.halfMistakes ?? 0),
        backspaces: backspaces,
        grossSpeed: undefined,
        netSpeed: undefined,
        result: result,
      });

      toast({
        title: "Test Submitted!",
        description: "Your results have been recorded.",
      });

      setSubmissionFailed(false);
      setShowResultModal(true);
    } catch (error) {
      console.error("Test submission error:", error);
      setSubmissionFailed(true);
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit your test results. Please use the retry button.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [testContent, currentUser, typedText, backspaces, createResult, toast]);

  const finishTest = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setIsFinished(true);
    
    // Auto submit logic
    handleSubmit();
  }, [handleSubmit]);

  useEffect(() => {
    if (isActive) {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        totalDurationRef.current = timeLeft;
      }
      
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        const remaining = Math.max(0, totalDurationRef.current - elapsed);
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          finishTest();
        }
      }, 100);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, finishTest]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    const textarea = e.currentTarget;
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    
    if (hasModifier) {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'Delete') {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
    }
    
    // For Pitman tests: block Tab and Home keys (same as shorthand)
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'Home') {
      e.preventDefault();
      return;
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullScreen(false));
      }
    }
  };

  const startTest = () => {
    if (cooldownRemaining > 0) {
      toast({
        variant: "destructive",
        title: "Test Cooldown Active",
        description: `Please wait ${Math.ceil(cooldownRemaining / 60000)} minutes before starting this test again.`,
      });
      return;
    }
    
    if (testContent && currentUser) {
      const cooldownKey = `test_cooldown_${testContent.id}_${currentUser.id}`;
      const cooldownEnd = Date.now() + (30 * 60 * 1000);
      localStorage.setItem(cooldownKey, cooldownEnd.toString());
      setCooldownRemaining(30 * 60 * 1000);
    }
    
    setIsActive(true);
    const textarea = document.getElementById("pitman-typing-area");
    if (textarea) textarea.focus();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const increasePdfZoom = () => {
    setPdfZoom(prev => Math.min(prev + 10, 200));
  };

  const decreasePdfZoom = () => {
    setPdfZoom(prev => Math.max(prev - 10, 50));
  };

  if (isContentLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading test...</span>
      </div>
    );
  }

  if (!testContent) {
    return <div className="p-8">Test not found</div>;
  }

  return (
    <div
      className={cn("flex flex-col space-y-4", isFullScreen ? "fixed inset-0 z-50 p-6" : "p-4")}
      style={{ height: isFullScreen ? '100vh' : 'calc(100vh - 64px)', maxHeight: isFullScreen ? '100vh' : 'calc(100vh - 64px)', overflow: 'hidden', backgroundColor: '#ffffff', position: isFullScreen ? 'fixed' : 'relative', zIndex: isFullScreen ? 50 : 1 }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0 gap-4">
        <div className="flex items-center gap-4">
          {!isFullScreen && (
            <Link href="/student">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <div>
            <h2 className="text-xl font-bold truncate max-w-[200px] md:max-w-md">{testContent.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">Pitman Book Exercise</span>
              <span>•</span>
              <span className="capitalize">{testContent.language}</span>
              <span>•</span>
              <span>{testContent.duration} Min</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullScreen} title="Toggle Full Screen">
              {isFullScreen ? <Minimize size={20}/> : <Maximize size={20}/>}
            </Button>
            
            <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2">
              <Type size={16} className="text-muted-foreground" />
              <Slider 
                value={[fontSize]} 
                onValueChange={(val) => setFontSize(val[0])} 
                min={12} max={32} step={2}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground w-6">{fontSize}px</span>
            </div>
          </div>

          <div className={cn(
            "text-3xl font-mono font-bold flex items-center gap-2 min-w-[100px] justify-end",
            timeLeft < 60 ? "text-red-500 animate-pulse" : "text-primary"
          )}>
            <Timer size={24} className="md:w-8 md:h-8" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      {/* Main Workspace - Two Column Layout */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* Left Section: PDF Viewer */}
        <Card className="flex flex-col overflow-hidden border-2 shadow-sm flex-1 basis-1/2">
          <CardHeader className="py-2 bg-muted/50 border-b flex flex-row justify-between items-center min-h-[40px] px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PDF Content</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={decreasePdfZoom}
                disabled={pdfZoom <= 50}
                className="h-8 w-8 p-0"
              >
                <ZoomOut size={16} />
              </Button>
              <span className="text-xs font-medium min-w-[40px] text-center">{pdfZoom}%</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={increasePdfZoom}
                disabled={pdfZoom >= 200}
                className="h-8 w-8 p-0"
              >
                <ZoomIn size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 custom-scrollbar">
            {pdfUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <iframe
                  key={pdfUrl}
                  ref={pdfIframeRef}
                  src={pdfUrl}
                  title="Test PDF"
                  className="w-full h-full border-0"
                  style={{ minHeight: "100%", minWidth: "100%", zoom: `${pdfZoom}%` }}
                  onLoad={() => console.log("PDF iframe loaded successfully")}
                  onError={() => console.error("Failed to load PDF in iframe")}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground opacity-50" />
                <div className="space-y-2">
                  <p className="font-semibold text-muted-foreground">No PDF Available</p>
                  <p className="text-sm text-muted-foreground">The PDF content for this test has not been uploaded yet.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Section: Text Input */}
        <Card className="flex flex-col overflow-hidden border-2 shadow-sm flex-1 basis-1/2">
          <CardHeader className="py-2 bg-muted/50 border-b flex flex-row justify-between items-center min-h-[40px] px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Input</CardTitle>
            {!isActive && !isFinished && (
              <div className="text-xs text-blue-600 font-medium animate-bounce">Click "Start" below</div>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
            <Textarea
              id="pitman-typing-area"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isActive}
              className={cn(
                "w-full h-full resize-none p-4 border-0 focus-visible:ring-0 rounded-none leading-relaxed"
              )}
              style={{ fontSize: `${fontSize}px`, backgroundColor: '#ffffff' }}
              placeholder={isActive ? "Start typing here..." : "Waiting to start..."}
              spellCheck={false}
              autoComplete="off"
              onPaste={(e) => e.preventDefault()}
            />
            
            {/* Overlay for inactive state */}
            {!isActive && !isFinished && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                {cooldownRemaining > 0 ? (
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-red-600">Cooldown Active</div>
                    <div className="text-2xl font-bold text-red-700">
                      {Math.floor(cooldownRemaining / 60000)}:{String(Math.floor((cooldownRemaining % 60000) / 1000)).padStart(2, '0')}
                    </div>
                    <div className="text-sm text-muted-foreground">Please wait before retaking this test</div>
                  </div>
                ) : (
                  <Button size="lg" onClick={startTest} className="text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform bg-gradient-to-r from-red-500 to-red-600">
                    Start Test
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Footer Controls */}
      <div className="shrink-0 flex justify-end gap-3 pb-2">
        {isActive && (
          <Button variant="destructive" onClick={finishTest} className="gap-2 shadow-lg">
            <Save size={16} /> Submit Test Early
          </Button>
        )}
        
        {/* Retry button when submission fails */}
        {isFinished && submissionFailed && (
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="gap-2 shadow-lg bg-red-600 hover:bg-red-700"
            data-testid="button-retry-submit"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> Retry Submit
              </>
            )}
          </Button>
        )}
      </div>

      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-green-600" /> Test Submitted
            </DialogTitle>
            <DialogDescription>
              Your test has been successfully submitted to the instructor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Link href="/student">
              <Button type="button" variant="default" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
