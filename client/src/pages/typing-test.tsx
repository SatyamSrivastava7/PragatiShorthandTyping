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
  const [selectedAudioWpm, setSelectedAudioWpm] = useState<"80" | "100">("80"); // Default to 80 WPM
  
  // Timer References
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);
  const originalTextRef = useRef<HTMLDivElement>(null);

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
    } else {
      metrics = calculateShorthandMetrics(testContent.text, typedText, testContent.duration);
      result = metrics.result;
      grossSpeed = undefined;
      netSpeed = undefined;
      halfMistakes = String(metrics.halfMistakes);
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
  
  // Auto-scroll logic (controlled by per-test setting)
  useEffect(() => {
    const autoScrollEnabled = testContent?.autoScroll ?? true;
    if (autoScrollEnabled && testContent?.type === 'typing' && originalTextRef.current) {
      const container = originalTextRef.current;
      const text = testContent.text;
      const currentLength = typedText.length;
      
      // Find the current line number by counting newlines up to cursor position
      const linesBeforeCursor = text.substring(0, currentLength).split('\n').length - 1;
      
      // Get all lines
      const allLines = text.split('\n');
      
      // Calculate approximate line height from the container
      const lineHeight = parseInt(window.getComputedStyle(container).lineHeight, 10);
      const containerHeight = container.clientHeight;
      
      // We want the current line to appear around 40% down the visible area
      // This ensures 2-3 previous lines remain visible above it
      const targetScrollPosition = Math.max(
        0,
        (linesBeforeCursor * lineHeight) - (containerHeight * 0.35)
      );
      
      // Smooth scroll with easing for a slower, more natural feel
      const currentScroll = container.scrollTop;
      const diff = targetScrollPosition - currentScroll;
      
      // Use a smooth transition: only move 30% of the distance per update
      // This makes the scroll feel slower and more natural
      const newScroll = currentScroll + diff * 0.3;
      
      container.scrollTop = newScroll;
    }
  }, [typedText, testContent]);

  const startTest = () => {
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
    
    // Shorthand tests allow free editing - no restrictions
    if (testContent?.type === 'shorthand') {
      // Only track backspaces for shorthand
      if (e.key === 'Backspace') {
        setBackspaceCount(prev => prev + 1);
      }
      return;
    }
    
    // Typing test restrictions below
    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    const wordBoundary = getWordBoundary(typedText);
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    
    // Block Delete key when cursor is before word boundary
    if (e.key === 'Delete') {
      if (cursorPos < wordBoundary) {
        e.preventDefault();
        return;
      }
    }
    
    if (e.key === 'Backspace') {
      // Block any modifier+backspace (Ctrl+Backspace deletes whole word)
      if (hasModifier) {
        e.preventDefault();
        return;
      }
      
      // Simple rule: can only backspace within current word (after the word boundary)
      // Once you type a space/enter, the previous word is locked
      if (cursorPos <= wordBoundary) {
        e.preventDefault();
        return;
      }
      setBackspaceCount(prev => prev + 1);
    }
    
    // Block modifier+Delete (Ctrl+Delete deletes word forward)
    if (e.key === 'Delete' && hasModifier) {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'ArrowLeft') {
      // Block if at boundary or if using modifier (which could jump words)
      if (cursorPos <= wordBoundary || hasModifier) {
        e.preventDefault();
        if (hasModifier) {
          textarea.setSelectionRange(wordBoundary, wordBoundary);
        }
      }
    }
    
    // Block Home key - would jump to start of line/text
    if (e.key === 'Home') {
      e.preventDefault();
      textarea.setSelectionRange(wordBoundary, wordBoundary);
    }
    
    // Block ArrowUp - would move to previous line
    if (e.key === 'ArrowUp') {
      e.preventDefault();
    }
    
    // Block Ctrl+A (select all) to prevent selecting previous words
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      textarea.setSelectionRange(wordBoundary, typedText.length);
    }
    
    // Block Ctrl+Z (undo) to prevent restoring previous state
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
    }
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    // Shorthand tests allow free selection - no restrictions
    if (testContent?.type === 'shorthand') return;
    
    const textarea = e.currentTarget;
    const wordBoundary = getWordBoundary(typedText);
    
    // If selection starts before word boundary, adjust it
    if (textarea.selectionStart < wordBoundary) {
      textarea.setSelectionRange(wordBoundary, Math.max(wordBoundary, textarea.selectionEnd));
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!isActive) return;
    
    // Shorthand tests allow free cursor movement - no restrictions
    if (testContent?.type === 'shorthand') return;
    
    const textarea = e.currentTarget;
    const wordBoundary = getWordBoundary(typedText);
    
    // If clicked before word boundary, move cursor to boundary
    setTimeout(() => {
      if (textarea.selectionStart < wordBoundary) {
        textarea.setSelectionRange(wordBoundary, wordBoundary);
      }
    }, 0);
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

  // Get the audio URL based on selected WPM
  const getSelectedAudioUrl = () => {
    if (selectedAudioWpm === "80" && testContent?.audio80wpm) {
      return testContent.audio80wpm;
    }
    if (selectedAudioWpm === "100" && testContent?.audio100wpm) {
      return testContent.audio100wpm;
    }
    return null;
  };

  // Check if both audio options are available
  const audio80Available = !!testContent?.audio80wpm;
  const audio100Available = !!testContent?.audio100wpm;
  const selectedAudioUrl = getSelectedAudioUrl();

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
        
        {/* Shorthand Audio Player - Prominent at top */}
        {testContent.type === 'shorthand' && (audio80Available || audio100Available || testContent.mediaUrl) && (
           <Card className="bg-muted/30 border-2 border-orange-200 shrink-0">
             <CardContent className="p-4 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                   <Music size={24} />
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg">Dictation Audio</h3>
                   <p className="text-sm text-muted-foreground">Listen carefully, write on your shorthand pad, then type below.</p>
                 </div>
               </div>

               {/* Speed Selector for Multi-Audio */}
               {(audio80Available || audio100Available) && (
                 <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                   <div className="flex items-center gap-2">
                     <label className="text-sm font-medium">Select Audio Speed:</label>
                     <Select value={selectedAudioWpm} onValueChange={(val) => setSelectedAudioWpm(val as "80" | "100")}>
                       <SelectTrigger className="w-32">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="80" disabled={!audio80Available}>
                           80 WPM {!audio80Available && "(Not available)"}
                         </SelectItem>
                         <SelectItem value="100" disabled={!audio100Available}>
                           100 WPM {!audio100Available && "(Not available)"}
                         </SelectItem>
                       </SelectContent>
                     </Select>
                   </div>

                   {/* Audio Not Found Message */}
                   {!selectedAudioUrl && (
                     <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
                       <AlertCircle size={18} className="text-red-600" />
                       <span className="text-sm text-red-700 font-medium">Audio file not found for {selectedAudioWpm} WPM</span>
                     </div>
                   )}
                 </div>
               )}

               {/* Audio Player */}
               {selectedAudioUrl ? (
                 <audio 
                   key={selectedAudioUrl}
                   id="shorthand-audio" 
                   src={selectedAudioUrl} 
                   controls 
                   className="w-full"
                   controlsList="nodownload" 
                 />
               ) : testContent.mediaUrl ? (
                 <audio 
                   id="shorthand-audio" 
                   src={testContent.mediaUrl} 
                   controls 
                   className="w-full"
                   controlsList="nodownload" 
                 />
               ) : null}
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
               <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
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