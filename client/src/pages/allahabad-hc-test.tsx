import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateTypingMetrics, cn, stripHtmlPreserveParagraphs, replaceNewlinesWithParaToken, PARA_TOKEN, stripHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Save, CheckCircle, ArrowLeft, Maximize, Minimize, Type, Loader2, AlertCircle, RefreshCw, ArrowDown } from "lucide-react";
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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean | null>(null);
  const [highlighterEnabled, setHighlighterEnabled] = useState<boolean>(true);
  const [userScrolled, setUserScrolled] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);
  const originalTextRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false);
  const lastParaCountRef = useRef<number>(0);
  const paraScrollUntilWordsRef = useRef<number>(0);
  const paraScrollUntilTimeRef = useRef<number>(0);

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
      setAutoScrollEnabled(testContent.autoScroll ?? true);
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

  // Handle manual scroll - detect if user scrolled
  useEffect(() => {
    const container = originalTextRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isAutoScrollingRef.current) {
        setUserScrolled(true);
      }
      isAutoScrollingRef.current = false;
      lastScrollTopRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollEnabled === null || !autoScrollEnabled || !originalTextRef.current) return;
    if (!isActive) return;
    
    const container = originalTextRef.current;
    const originalText = testContent?.text || "";
    
    const plainText = stripHtmlPreserveParagraphs(originalText);
    const processedTyped = replaceNewlinesWithParaToken(typedText);
    const paraCount = (processedTyped.match(/\[\[PARA\]\]/g) || []).length;
    const typedWords = processedTyped.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN).length;

    const isNewParagraph = paraCount > lastParaCountRef.current;
    if (isNewParagraph) {
      lastParaCountRef.current = paraCount;
      paraScrollUntilWordsRef.current = typedWords + 5;
      paraScrollUntilTimeRef.current = Date.now() + 1500;
    }
    
    const originalWords = plainText.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN);
    const totalOriginalWords = originalWords.length;
    
    if (totalOriginalWords === 0) return;
    
    const scrollableHeight = container.scrollHeight - container.clientHeight;
    const progress = Math.min(typedWords / totalOriginalWords, 1);
    const targetScrollPosition = Math.max(0, progress * scrollableHeight);
    
    const currentScroll = container.scrollTop;
    let diff = targetScrollPosition - currentScroll;
    
    const now = Date.now();
    const boostedActive = (typedWords <= paraScrollUntilWordsRef.current) || (now <= paraScrollUntilTimeRef.current);
    const scrollFactor = boostedActive ? 0.8 : 0.35;

    if (Math.abs(diff) < 2 && !boostedActive) return;
    
    if (userScrolled && !boostedActive) {
      const lagThreshold = scrollableHeight * 0.3;
      if (diff < lagThreshold) return;
    }
    
    isAutoScrollingRef.current = true;
    container.scrollTop = currentScroll + diff * scrollFactor;
    lastScrollTopRef.current = container.scrollTop;
    
  }, [typedText, testContent, userScrolled, isActive, autoScrollEnabled]);

  const getHighlightedContent = () => {
    if (!testContent) return '';

    if (!highlighterEnabled) {
      return testContent.text;
    }

    const plainText = stripHtmlPreserveParagraphs(testContent.text);
    const words = plainText.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN);

    const tokens = typedText.split(/\s+/).filter(w => w && w !== PARA_TOKEN);
    let currentIndex: number | null = null;
    if (typedText.trim() === "") {
      currentIndex = 0;
    } else if (/\s$/.test(typedText)) {
      currentIndex = tokens.length;
    } else {
      currentIndex = Math.max(0, tokens.length - 1);
    }

    if (currentIndex === null || currentIndex >= words.length) {
      return testContent.text;
    }

    const targetWord = words[currentIndex];
    if (!targetWord) return testContent.text;

    let wordOccurrenceCount = 0;
    let foundTargetWord = false;
    
    const htmlContent = testContent.text;
    const parts = htmlContent.split(/(<[^>]+>)/);
    
    const processedParts = parts.map((part) => {
      if (part.startsWith('<')) {
        return part;
      }
      
      if (foundTargetWord || !part) {
        return part;
      }
      
      const textWords = part.split(/(\s+)/);
      
      return textWords.map((segment) => {
        if (foundTargetWord || !segment || /^\s+$/.test(segment)) {
          return segment;
        }
        
        if (segment === targetWord) {
          if (wordOccurrenceCount === currentIndex) {
            foundTargetWord = true;
            return `<span style="background-color: #fbbf24; padding: 2px 4px; border-radius: 2px; font-weight: 500;">${segment}</span>`;
          }
          wordOccurrenceCount++;
        } else if (!/^\s+$/.test(segment)) {
          wordOccurrenceCount++;
        }
        
        return segment;
      }).join('');
    }).join('');

    return processedParts;
  };

  // Start test
  const handleStartTest = () => {
    setUserScrolled(false);
    
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
  };

  // Start test timer
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

  const handleStartClick = () => {
    handleStartTest();
    handleStart();
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
      <div className={cn("mx-auto w-full", isFullScreen ? "p-4" : "p-6")}>
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
              <div className="flex items-center gap-6 flex-1 justify-center">
                <div className="flex items-center gap-3">
                  <Label className="min-w-fit text-sm font-medium">Font Size</Label>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(val) => setFontSize(val[0])}
                    min={12}
                    max={32}
                    step={1}
                    className="w-32"
                  />
                  <span className="text-sm font-semibold min-w-fit">{fontSize}px</span>
                </div>
              </div>
              <div className="flex gap-3">
                {!isActive ? (
                  <Button
                    onClick={handleStartClick}
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

        {/* Controls Bar */}
        {isActive && (
          <Card className="shadow-lg border-0 mb-6 bg-gradient-to-r from-purple-50 to-blue-50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={autoScrollEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                  className={cn(
                    "gap-2 transition-all",
                    autoScrollEnabled 
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md" 
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  title={autoScrollEnabled ? "Click to disable auto-scroll" : "Click to enable auto-scroll"}
                >
                  <ArrowDown size={16} />
                  <span className="text-xs font-medium">
                    {autoScrollEnabled ? "Auto-scroll ON" : "Auto-scroll OFF"}
                  </span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={highlighterEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHighlighterEnabled(!highlighterEnabled)}
                  className={cn(
                    "gap-2 transition-all",
                    highlighterEnabled 
                      ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md" 
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  title={highlighterEnabled ? "Click to disable word highlighting" : "Click to enable word highlighting"}
                >
                  <Type size={16} />
                  <span className="text-xs font-medium">
                    {highlighterEnabled ? "Highlight ON" : "Highlight OFF"}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content - Vertical Layout */}
        <div className="flex flex-col gap-6 mb-6 h-[calc(100vh-500px)] min-h-[500px]">
          {/* Original Text */}
          <Card className="shadow-lg border-0 h-[40%] overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b">
              <CardTitle className="text-lg">Original Text</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 overflow-auto" ref={originalTextRef}>
              <div
                className="p-4 rounded-lg select-none"
                style={{ fontSize: `${fontSize}px`, lineHeight: "1.8" }}
                dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
              />
            </CardContent>
          </Card>

          {/* Your Input - RichTextEditor */}
          <Card className="shadow-lg border-0 h-[60%] overflow-hidden flex flex-col">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-green-50 border-b">
              <CardTitle className="text-lg">Your Input</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex-1 min-h-0">
                <RichTextEditor
                  value={typedText}
                  onChange={setTypedText}
                  placeholder="Click here and start typing..."
                  label=""
                  showWordCount={true}
                  fontClass={testContent.language === "hindi" ? "font-mangal" : ""}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
              </div>
            </CardContent>
          </Card>
        </div>

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
