import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateTypingMetrics, cn, stripHtmlPreserveParagraphs, replaceNewlinesWithParaToken, PARA_TOKEN, stripHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Save, CheckCircle, ArrowLeft, Maximize, Minimize, Loader2, AlertCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/RichTextEditor";

export default function AllahabadHCTestPage() {
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
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
    }
  }, [testContent]);

  // Cooldown check - 30 minutes after starting test
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
    
    if (!testContent || !currentUser) {
      toast({ variant: "destructive", title: "Error", description: "Missing test or user data" });
      return;
    }
    
    setIsSubmitting(true);
    setSubmissionFailed(false);
    
    try {
      // Store with HTML + PARA_TOKEN for display
      const storedTypedText = replaceNewlinesWithParaToken(typedText);
      
      // Clean text for metrics (no HTML, no PARA_TOKEN)
      const cleanTestText = stripHtml(testContent.text).replace(/\[\[PARA\]\]/g, '');
      const cleanTypedText = stripHtml(storedTypedText).replace(/\[\[PARA\]\]/g, '');
      
      // Calculate metrics using same logic as typing test
      const metrics = calculateTypingMetrics(cleanTestText, cleanTypedText, testContent.duration, backspaces);
      
      // Determine Pass/Fail based on 5% mistake rule
      const mistakePercentage = metrics.words > 0 ? (metrics.mistakes / metrics.words) * 100 : 0;
      const testResult = mistakePercentage > 5 ? 'Fail' : 'Pass';
      const grossSpeed = String(metrics.grossSpeed);
      const netSpeed = String(metrics.netSpeed);
      const halfMistakes = String(metrics.halfMistakes ?? 0);
      
      console.log("Submitting result:", { contentId: testContent.id, typedText: storedTypedText, words: metrics.words });
      
      const submittedResult = await createResult({
        contentId: testContent.id,
        typedText: storedTypedText,
        words: metrics.words,
        time: totalDurationRef.current,
        mistakes: String(metrics.mistakes),
        halfMistakes,
        backspaces,
        grossSpeed,
        netSpeed,
        result: testResult,
      });
      console.log("Result submitted successfully:", submittedResult);
      
      // Set cooldown after successful submission
      if (testContent && currentUser) {
        const cooldownKey = `test_cooldown_${testContent.id}_${currentUser.id}`;
        const cooldownEnd = Date.now() + 30 * 60 * 1000; // 30 minutes
        localStorage.setItem(cooldownKey, cooldownEnd.toString());
        setCooldownRemaining(30 * 60 * 1000);
      }
      
      setIsFinished(true);
      setShowResultModal(true);
      
      toast({
        variant: "success",
        title: "Success",
        description: "Test submitted successfully!",
      });
    } catch (error) {
      console.error("Submission error:", error);
      setSubmissionFailed(true);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit test",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [testContent, currentUser, typedText, backspaces, createResult, toast]);

  // Start test
  const handleStart = () => {
    setIsActive(true);
    startTimeRef.current = Date.now();
    totalDurationRef.current = 0;
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setIsActive(false);
          setIsFinished(true);
          handleSubmit();
          return 0;
        }
        if (startTimeRef.current) {
          totalDurationRef.current = Math.floor((Date.now() - startTimeRef.current) / 1000);
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Stop test
  const handleStop = () => {
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isActive) return;
    
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    
    // Block Ctrl+C, Ctrl+V (copy/paste), Ctrl+X (cut), Alt, Cmd combinations
    // But ALLOW Shift combinations (needed for IME and special characters)
    if (hasModifier) {
      e.preventDefault();
      return;
    }
    
    // Track backspaces
    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isContentLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3">Loading test...</span>
      </div>
    );
  }

  if (!testContent) {
    return (
      <div className="flex items-center justify-center p-8">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <span className="ml-3">Test not found</span>
      </div>
    );
  }

  // Show cooldown message
  if (cooldownRemaining > 0) {
    const minutes = Math.floor(cooldownRemaining / 60000);
    const seconds = Math.floor((cooldownRemaining % 60000) / 1000);
    
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Link href="/student">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <Card className="shadow-lg border-0 bg-yellow-50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Cooldown Active</h2>
            <p className="text-gray-600 mb-4">
              Please wait before taking this test again.
            </p>
            <p className="text-lg font-semibold text-yellow-700">
              Time remaining: {minutes}m {seconds}s
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("w-full", isFullScreen ? "fixed inset-0 z-50 bg-white overflow-auto" : "")}>
      <div className={cn("mx-auto", isFullScreen ? "p-4" : "max-w-6xl p-8")}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isFullScreen && (
              <Link href="/student">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-3xl font-bold">{testContent.title}</h1>
              <p className="text-muted-foreground">{testContent.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="gap-2"
            >
              {isFullScreen ? (
                <>
                  <Minimize className="h-4 w-4" />
                  Exit
                </>
              ) : (
                <>
                  <Maximize className="h-4 w-4" />
                  Fullscreen
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Timer and Controls */}
        {!isFinished && (
          <Card className="shadow-lg border-0 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Timer className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Time Remaining</p>
                  <p className="text-3xl font-bold text-primary font-mono">{formatTime(timeLeft)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {!isActive ? (
                  <Button
                    onClick={handleStart}
                    disabled={isActive}
                    className="bg-gradient-to-r from-green-500 to-green-600 shadow-lg hover:shadow-xl transition-all px-8 gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Start Test
                  </Button>
                ) : (
                  <Button
                    onClick={handleStop}
                    variant="outline"
                    className="px-8 gap-2"
                  >
                    Stop
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content and Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Original Text */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b">
              <CardTitle className="text-lg">Original Text</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-y-auto"
                style={{ fontSize: `${fontSize}px`, maxHeight: "400px", lineHeight: "1.8" }}
                dangerouslySetInnerHTML={{ __html: testContent.text || "" }}
              />
            </CardContent>
          </Card>

          {/* RichTextEditor for Typed Text */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-green-50 border-b">
              <CardTitle className="text-lg">Your Answer</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RichTextEditor
                value={typedText}
                onChange={setTypedText}
                placeholder="Click here and start typing..."
                label=""
                showWordCount={true}
                fontClass={testContent.language === "hindi" ? "font-mangal" : ""}
              />
            </CardContent>
          </Card>
        </div>

        {/* Font Size Control */}
        {!isFinished && (
          <Card className="shadow-lg border-0 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Label className="min-w-fit">Font Size</Label>
                <Slider
                  value={[fontSize]}
                  onValueChange={(val) => setFontSize(val[0])}
                  min={12}
                  max={32}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-semibold min-w-fit">{fontSize}px</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        {!isFinished && isActive && (
          <div className="flex justify-end gap-3 mb-6">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-md hover:shadow-lg transition-all px-8 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Submit Test
                </>
              )}
            </Button>
          </div>
        )}

        {submissionFailed && (
          <Card className="shadow-lg border-0 mb-6 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Submission Failed</p>
                <p className="text-sm text-gray-600 mt-1">Please try submitting again</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Result Modal */}
      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Submitted</DialogTitle>
            <DialogDescription>
              Your test has been submitted successfully. You can now view your results on your dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Link href="/student">
              <Button className="w-full bg-gradient-to-r from-green-500 to-green-600">
                Go to Dashboard
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
