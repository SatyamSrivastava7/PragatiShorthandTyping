import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateTypingMetrics, calculateShorthandMetrics, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Save, CheckCircle, Music, ArrowLeft, Maximize, Minimize, Type, RefreshCw, Loader2, AlertCircle } from "lucide-react";
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

export default function TypingTestPage() {
  const [, params] = useRoute("/test/:id");
  const { user: currentUser } = useAuth();
  const { data: testContent, isLoading: isContentLoading } = useContentById(params?.id ? Number(params.id) : undefined);
  const { createResult } = useResults(undefined, false); // Only use POST, disable GET query
  const { toast } = useToast();
  
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [backspaces, setBackspaceCount] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [selectedVideoWpm, setSelectedVideoWpm] = useState<"60" | "80" | "100" | "120">("80"); // Default to 80 WPM
  const [userScrolled, setUserScrolled] = useState(false); // Track if user manually scrolled
  
  // Timer References
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);
  const originalTextRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false); // Flag to track if current scroll is programmatic

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
    let grossSpeed: string | undefined;
    let netSpeed: string | undefined;
    let halfMistakes: string | undefined;

    if (testContent.type === 'typing') {
      metrics = calculateTypingMetrics(testContent.text, typedText, testContent.duration, backspaces);
      // Determine Pass/Fail based on 5% mistake rule
      const mistakePercentage = metrics.words > 0 ? (metrics.mistakes / metrics.words) * 100 : 0;
      result = mistakePercentage > 5 ? 'Fail' : 'Pass';
      grossSpeed = String(metrics.grossSpeed);
      netSpeed = String(metrics.netSpeed);
      halfMistakes = String(metrics.halfMistakes ?? 0);
    } else {
      metrics = calculateShorthandMetrics(testContent.text, typedText, testContent.duration);
      result = metrics.result;
      grossSpeed = undefined;
      netSpeed = undefined;
      halfMistakes = String(metrics.halfMistakes ?? 0);
    }

    try {
      await createResult({
        contentId: testContent.id,
        typedText: typedText,
        words: metrics.words,
        time: testContent.duration,
        mistakes: String(metrics.mistakes),
        halfMistakes,
        backspaces: backspaces,
        grossSpeed: grossSpeed,
        netSpeed: netSpeed,
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
      // Initialize start time when test becomes active
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        totalDurationRef.current = timeLeft;
      }
      
      // Use a single interval that calculates remaining time from elapsed
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        const remaining = Math.max(0, totalDurationRef.current - elapsed);
        setTimeLeft(remaining);
        
        if (remaining === 0) {
          // Time's up - clear interval and finish
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          finishTest();
        }
      }, 100); // Check more frequently for accuracy
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, finishTest]);
  
  // Handle manual scroll - detect if user scrolled and disable auto-scroll temporarily
  useEffect(() => {
    const container = originalTextRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only mark as manually scrolled if this scroll wasn't triggered by auto-scroll
      if (!isAutoScrollingRef.current) {
        setUserScrolled(true);
      }
      isAutoScrollingRef.current = false; // Reset the flag after scroll event
      lastScrollTopRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll logic (controlled by per-test setting)
  useEffect(() => {
    const autoScrollEnabled = testContent?.autoScroll ?? true;
    if (autoScrollEnabled && testContent?.type === 'typing' && originalTextRef.current) {
      const container = originalTextRef.current;
      const text = testContent.text;
      const currentLength = typedText.length;
      
      // Find the current line number by counting newlines up to cursor position
      const linesBeforeCursor = text.substring(0, currentLength).split('\n').length - 1;
      
      // Calculate approximate line height from the container
      const lineHeight = parseInt(window.getComputedStyle(container).lineHeight, 10);
      const containerHeight = container.clientHeight;
      
      // Current scroll and cursor positions
      const currentScroll = container.scrollTop;
      const cursorBottomPosition = (linesBeforeCursor + 1) * lineHeight;
      const visibleAreaBottom = currentScroll + containerHeight;
      
      // Check if cursor is outside visible area (below the bottom or above the top)
      const cursorOutOfView = cursorBottomPosition > visibleAreaBottom || cursorBottomPosition < currentScroll;
      
      // ONLY auto-scroll if:
      // 1. User hasn't manually scrolled yet (initial typing), OR
      // 2. Cursor is WAY out of view (more than full screen below) - emergency auto-scroll
      const emergencyScrollNeeded = cursorBottomPosition > visibleAreaBottom + containerHeight;
      
      if (!userScrolled || emergencyScrollNeeded) {
        // We want the current line to appear around 40% down the visible area
        // This ensures 2-3 previous lines remain visible above it
        const targetScrollPosition = Math.max(
          0,
          (linesBeforeCursor * lineHeight) - (containerHeight * 0.35)
        );
        
        const diff = targetScrollPosition - currentScroll;
        
        // Use a smooth transition: only move 30% of the distance per update
        // This makes the scroll feel slower and more natural
        const newScroll = currentScroll + diff * 0.3;
        
        // Mark that we're doing a programmatic scroll
        isAutoScrollingRef.current = true;
        container.scrollTop = newScroll;
        lastScrollTopRef.current = newScroll;
      }
    }
  }, [typedText, testContent, userScrolled]);

  const startTest = () => {
    // Reset scroll tracking when test starts
    setUserScrolled(false);
    
    // Check cooldown before starting
    if (cooldownRemaining > 0) {
      toast({
        variant: "destructive",
        title: "Test Cooldown Active",
        description: `Please wait ${Math.ceil(cooldownRemaining / 60000)} minutes before starting this test again.`,
      });
      return;
    }
    
    // Set cooldown for 30 minutes from now
    if (testContent && currentUser) {
      const cooldownKey = `test_cooldown_${testContent.id}_${currentUser.id}`;
      const cooldownEnd = Date.now() + (30 * 60 * 1000); // 30 minutes
      localStorage.setItem(cooldownKey, cooldownEnd.toString());
      setCooldownRemaining(30 * 60 * 1000);
    }
    
    setIsActive(true);
    // Focus textarea
    const textarea = document.getElementById("typing-area");
    if (textarea) textarea.focus();
  };

  const getWordBoundary = (text: string) => {
    // Find the last word separator (space or newline)
    let lastSeparatorIndex = -1;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === ' ' || text[i] === '\n') {
        lastSeparatorIndex = i;
        break;
      }
    }
    return lastSeparatorIndex >= 0 ? lastSeparatorIndex + 1 : 0;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    const textarea = e.currentTarget;
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    
    // Block any modifier combinations (Ctrl, Alt, Cmd) - for all test types
    if (hasModifier) {
      e.preventDefault();
      return;
    }
    
    // Block Delete key entirely - for all test types
    if (e.key === 'Delete') {
      e.preventDefault();
      return;
    }
    
    // Track backspaces for all test types
    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
    }
    
    // Typing test specific restrictions
    if (testContent?.type === 'typing') {
      // Only allow: Shift, Enter, Space, and regular characters (letters, numbers, punctuation)
      const allowedKeys = ['Shift', 'Enter', ' ', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowDown'];
      const isRegularCharacter = e.key.length === 1; // Single character key (letters, numbers, punctuation)
      
      // Block all keys except the allowed ones and regular characters
      if (!allowedKeys.includes(e.key) && !isRegularCharacter) {
        e.preventDefault();
        return;
      }

      const cursorPos = textarea.selectionStart;
      const wordBoundary = getWordBoundary(typedText);
      
      if (e.key === 'Backspace') {
        // Can only backspace within current word (after the word boundary)
        if (cursorPos <= wordBoundary) {
          e.preventDefault();
          return;
        }
      }
      
      if (e.key === 'ArrowLeft') {
        // Block if at boundary
        if (cursorPos <= wordBoundary) {
          e.preventDefault();
        }
      }
      
      // Block Home key - would jump to start of line/text - only for typing
      if (e.key === 'Home') {
        e.preventDefault();
        textarea.setSelectionRange(wordBoundary, wordBoundary);
      }
      
      // Block ArrowUp - would move to previous line - only for typing
      if (e.key === 'ArrowUp') {
        e.preventDefault();
      }
      
      // Block Tab key - move to next element - only for typing
      if (e.key === 'Tab') {
        e.preventDefault();
      }
    } else if (testContent?.type === 'shorthand') {
      // For shorthand tests: block Tab and Home keys
      if (e.key === 'Tab') {
        e.preventDefault();
        return;
      }
      
      if (e.key === 'Home') {
        e.preventDefault();
        return;
      }
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    const textarea = e.currentTarget;
    
    // For typing tests - restrict selection to word boundary
    if (testContent?.type === 'typing') {
      const wordBoundary = getWordBoundary(typedText);
      
      // If selection starts before word boundary, adjust it
      if (textarea.selectionStart < wordBoundary) {
        textarea.setSelectionRange(wordBoundary, Math.max(wordBoundary, textarea.selectionEnd));
      }
    }
    // For shorthand tests - allow free selection
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    const textarea = e.currentTarget;
    
    // For typing tests - restrict cursor movement to word boundary
    if (testContent?.type === 'typing') {
      const wordBoundary = getWordBoundary(typedText);
      
      // If clicked before word boundary, move cursor to boundary
      setTimeout(() => {
        if (textarea.selectionStart < wordBoundary) {
          textarea.setSelectionRange(wordBoundary, wordBoundary);
        }
      }, 0);
    }
    // For shorthand tests - allow free cursor movement
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

  // Video functionality - Get the video URL based on selected WPM
  const getSelectedVideoUrl = () => {
    if (!testContent) return null;
    
    // Map selected WPM to the corresponding video field
    const videoFieldMap: Record<"60" | "80" | "100" | "120", keyof typeof testContent> = {
      "60": "video60wpm",
      "80": "video80wpm",
      "100": "video100wpm",
      "120": "video120wpm",
    };
    
    const videoField = videoFieldMap[selectedVideoWpm];
    const value = testContent[videoField];
    return typeof value === 'string' ? value : null;
  };

  // Check which video speeds are available
  const video60Available = testContent?.video60wpm ? true : false;
  const video80Available = testContent?.video80wpm ? true : false;
  const video100Available = testContent?.video100wpm ? true : false;
  const video120Available = testContent?.video120wpm ? true : false;
  const selectedVideoUrl = getSelectedVideoUrl();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Font family based on language selection
  // Updated to use custom 'font-mangal' class if Hindi, Times New Roman for English
  const fontClass = testContent.language === 'hindi' ? 'font-mangal' : 'font-times';

  return (
    <div className={cn("h-full flex flex-col space-y-4 max-h-[calc(100vh-4rem)]", isFullScreen ? "fixed inset-0 z-50 bg-background p-6 max-h-screen" : "")}>
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

            {/* Video Speed Selector for Shorthand Tests */}
            {testContent.type === 'shorthand' && (
              <div className="hidden md:flex items-center gap-2 border-l pl-4 ml-2">
                <label className="text-xs font-medium whitespace-nowrap">Audio Speed:</label>
                <Select value={selectedVideoWpm} onValueChange={(val) => setSelectedVideoWpm(val as "60" | "80" | "100" | "120")}>
                  <SelectTrigger className="w-24 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60" disabled={!video60Available}>60 WPM</SelectItem>
                    <SelectItem value="80" disabled={!video80Available}>80 WPM</SelectItem>
                    <SelectItem value="100" disabled={!video100Available}>100 WPM</SelectItem>
                    <SelectItem value="120" disabled={!video120Available}>120 WPM</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Video Link - Click to open in new tab */}
                {selectedVideoUrl && (
                  <a 
                    href={selectedVideoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline font-medium whitespace-nowrap"
                  >
                    Open Audio
                  </a>
                )}
              </div>
            )}
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
        
        {/* Shorthand Video Player - Prominent at top */}
        {testContent.type === 'shorthand' && (video60Available || video80Available || video100Available || video120Available) && (
           <Card className="bg-muted/30 border-2 border-orange-200 shrink-0">
             <CardContent className="p-4 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                   <Music size={24} />
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg">Dictation Audio</h3>
                   <p className="text-sm text-muted-foreground">Select the audio speed from the header and listen the dictation audio.</p>
                 </div>
               </div>

               {/* Audio Not Found Message */}
               {!selectedVideoUrl && (
                 <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                   <AlertCircle size={18} className="text-red-600" />
                   <span className="text-sm text-red-700 font-medium">Audio not available for {selectedVideoWpm} WPM. Please select a different speed.</span>
                 </div>
               )}
             </CardContent>
           </Card>
        )}

        {/* Original Content - Hidden for Shorthand */}
        {testContent.type === 'typing' && (
           <Card className="flex flex-col h-[40%] overflow-hidden border-2 shadow-sm shrink-0">
            <CardHeader className="py-2 bg-muted/50 border-b min-h-[40px] px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Original Text</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 select-none custom-scrollbar relative" ref={originalTextRef}>
              <div 
                className={cn("leading-relaxed whitespace-pre-wrap select-none transition-all", fontClass)}
                style={{ fontSize: `${fontSize}px` }}
              >
                {/* Highlight Logic could go here, for now simpler implementation */}
                {testContent.text}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Typing Area */}
        <Card className={cn("flex flex-col overflow-hidden border-2 shadow-sm flex-1", testContent.type === 'shorthand' ? "h-full" : "")}>
          <CardHeader className="py-2 bg-muted/50 border-b flex flex-row justify-between items-center min-h-[40px] px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Input</CardTitle>
             {!isActive && !isFinished && (
               <div className="text-xs text-blue-600 font-medium animate-bounce">Click "Start" below</div>
             )}
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
             <Textarea
              id="typing-area"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onClick={handleClick}
              disabled={!isActive}
              className={cn(
                "w-full h-full resize-none p-4 border-0 focus-visible:ring-0 rounded-none bg-transparent leading-relaxed", 
                fontClass
              )}
              style={{ fontSize: `${fontSize}px` }}
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
                     <div className="text-lg font-semibold text-orange-600">Cooldown Active</div>
                     <div className="text-2xl font-bold text-orange-700">
                       {Math.floor(cooldownRemaining / 60000)}:{String(Math.floor((cooldownRemaining % 60000) / 1000)).padStart(2, '0')}
                     </div>
                     <div className="text-sm text-muted-foreground">Please wait before retaking this test</div>
                   </div>
                 ) : (
                   <Button size="lg" onClick={startTest} className="text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform">
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
              className="gap-2 shadow-lg bg-orange-600 hover:bg-orange-700"
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