import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateTypingMetrics, cn, stripHtmlPreserveParagraphs, replaceNewlinesWithParaToken, PARA_TOKEN, stripHtml } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
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
      // For Allahabad-HC, typed text from RichTextEditor contains HTML formatting (bold, italic, etc.)
      // We need to preserve HTML + PARA_TOKEN while also creating clean versions for metrics
      
      // Convert RichTextEditor HTML to PARA_TOKEN format while preserving HTML formatting
      let processedTypedText = typedText;
      // Replace <p> closing tags and <br> tags with PARA_TOKEN
      processedTypedText = processedTypedText.replace(/<\s*\/\s*p\s*>/gi, ' [[PARA]] ');
      processedTypedText = processedTypedText.replace(/<\s*br\s*\/?>/gi, ' [[PARA]] ');
      processedTypedText = processedTypedText.replace(/<\s*p[^>]*>/gi, ' ');
      processedTypedText = processedTypedText.replace(/\s+/g, ' ').trim();
      
      // Store with HTML + PARA_TOKEN for display
      const storedTypedText = processedTypedText;
      
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
      
      console.log("Submitting result:", { contentId: testContent.id, typedText: storedTypedText.substring(0, 100), words: metrics.words, time: totalDurationRef.current, mistakes: metrics.mistakes });
      
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
      
      // Invalidate results queries to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['results'] });
      
      // Also refetch the counts specifically
      await queryClient.invalidateQueries({ queryKey: ['results', 'counts'] });
      
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
    const scrollFactor = boostedActive ? 0.5 : 0.25;

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

  // Start test - combined function matching typing test pattern
  const handleStartClick = () => {
    // Reset scroll tracking when test starts
    setUserScrolled(false);
    
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
    setIsFinished(true);
    handleSubmit();
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

  // Show cooldown message only if test is finished and user hasn't seen the modal yet
  if (cooldownRemaining > 0 && !isFinished) {
    const minutes = Math.floor(cooldownRemaining / 60000);
    const seconds = Math.floor((cooldownRemaining % 60000) / 1000);
    
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Link href="/student?tab=allahabad-hc_tests">
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
    <div
      className={cn("flex flex-col space-y-4", isFullScreen ? "fixed inset-0 z-[60] p-6" : "p-4")}
      style={{
        height: isFullScreen ? '100vh' : 'calc(100vh - 64px)',
        maxHeight: isFullScreen ? '100vh' : 'calc(100vh - 64px)',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        position: isFullScreen ? 'fixed' : 'relative',
        zIndex: isFullScreen ? 60 : 1,
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0 gap-4">
        <div className="flex items-center gap-4">
          {!isFullScreen && (
            <Link href="/student?tab=allahabad-hc_tests">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <div>
            <h2 className="text-xl font-bold truncate max-w-[200px] md:max-w-md">{testContent.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="capitalize">{testContent.type} Test</span>
              <span>•</span>
              <span className="capitalize">{testContent.language}</span>
              <span>•</span>
              <span>{testContent.duration} Min</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} title="Toggle Full Screen">
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

            {/* Auto-scroll Toggle */}
            {autoScrollEnabled !== null && (
              <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2">
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
            )}

            {/* Word Highlighter Toggle */}
            <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2">
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

      {/* Main Workspace - Vertical Layout */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        
        {/* Original Content */}
        <Card className="flex flex-col h-[30%] overflow-hidden border-2 shadow-sm shrink-0">
          <CardHeader className="py-2 bg-muted/50 border-b min-h-[40px] px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original Text</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 select-none custom-scrollbar relative" ref={originalTextRef}>
            <div 
              className={cn("leading-relaxed select-none transition-all")}
              style={{ fontSize: `${fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
            />
          </CardContent>
        </Card>

        {/* Your Input - RichTextEditor */}
        <Card className={cn("flex flex-col overflow-hidden border-2 shadow-sm flex-1")}>
          <CardHeader className="py-2 bg-muted/50 border-b flex flex-row justify-between items-center min-h-[40px] px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Input</CardTitle>
            {!isActive && !isFinished && (
              <div className="text-xs text-blue-600 font-medium animate-bounce">Click "Start" below</div>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0 relative overflow-hidden">
            <div className="h-full overflow-hidden">
              <RichTextEditor
                value={typedText}
                onChange={setTypedText}
                placeholder={isActive ? "Start typing here..." : "Waiting to start..."}
                label=""
                showWordCount={true}
                fillHeight={true}
                fontClass={testContent.language === "hindi" ? "font-mangal" : ""}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
              />
            </div>
            
            {/* Overlay for inactive state */}
            {!isActive && !isFinished && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                {cooldownRemaining > 0 ? (
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-orange-600">Cooldown Active</div>
                    <div className="text-2xl font-bold text-orange-700">
                      {Math.floor(cooldownRemaining / 60000)}:{String(Math.floor((cooldownRemaining % 60000) / 1000)).padStart(2, '0')}
                    </div>
                    <div className="text-sm text-muted-foreground">Please wait before retaking this test</div>
                  </div>
                ) : (
                  <Button size="lg" onClick={handleStartClick} className="text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform">
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
          <Button variant="destructive" onClick={handleStop} className="gap-2 shadow-lg">
            <Save size={16} /> Submit Test Early
          </Button>
        )}
        
        {/* Retry button when submission fails */}
        {isFinished && submissionFailed && (
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700"
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
            <Link href="/student?tab=allahabad-hc_tests">
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
