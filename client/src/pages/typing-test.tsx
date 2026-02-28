import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useAuth, useContentById, useResults } from "@/lib/hooks";
import { calculateTypingMetrics, calculateShorthandMetrics, cn, stripHtmlPreserveParagraphs, replaceNewlinesWithParaToken, PARA_TOKEN } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Save, CheckCircle, Music, ArrowLeft, Maximize, Minimize, Type, RefreshCw, Loader2, AlertCircle, ArrowDown } from "lucide-react";
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
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean | null>(null); // Null until testContent loads
  const [highlighterEnabled, setHighlighterEnabled] = useState<boolean>(true); // Enable/disable word highlighting
  
  // Timer References
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const totalDurationRef = useRef<number>(0);
  const originalTextRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false); // Flag to track if current scroll is programmatic
  const lastParaCountRef = useRef<number>(0); // Track previous paragraph count to detect new breaks
  const paraScrollUntilWordsRef = useRef<number>(0); // when >0, use boosted scroll factor until typedWords > this
  const paraScrollUntilTimeRef = useRef<number>(0); // when > now, use boosted scroll factor until this timestamp

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
      // Initialize autoScrollEnabled from testContent
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

    // Convert any newlines to paragraph tokens for storage and analysis
    const storedTypedText = replaceNewlinesWithParaToken(typedText);

    if (testContent.type === 'typing') {
      metrics = calculateTypingMetrics(testContent.text, storedTypedText, testContent.duration, backspaces);
      // Determine Pass/Fail based on 5% mistake rule
      const mistakePercentage = metrics.words > 0 ? (metrics.mistakes / metrics.words) * 100 : 0;
      result = mistakePercentage > 5 ? 'Fail' : 'Pass';
      grossSpeed = String(metrics.grossSpeed);
      netSpeed = String(metrics.netSpeed);
      halfMistakes = String(metrics.halfMistakes ?? 0);
    } else {
      metrics = calculateShorthandMetrics(testContent.text, storedTypedText, testContent.duration);
      result = metrics.result;
      grossSpeed = undefined;
      netSpeed = undefined;
      halfMistakes = String(metrics.halfMistakes ?? 0);
    }

    try {
      await createResult({
        contentId: testContent.id,
        // Save processed typed text (newlines -> paragraph token)
        typedText: storedTypedText,
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
  
  // Handle manual scroll - detect if user scrolled
  useEffect(() => {
    const container = originalTextRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only mark as manually scrolled if this scroll wasn't triggered by auto-scroll
      if (!isAutoScrollingRef.current) {
        setUserScrolled(true);
      }
      isAutoScrollingRef.current = false;
      lastScrollTopRef.current = container.scrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll logic - scrolls original text to follow typing progress
  // Content moves from bottom to top (current word stays near top of visible area)
  useEffect(() => {
    if (autoScrollEnabled === null || !autoScrollEnabled || testContent?.type !== 'typing' || !originalTextRef.current) return;
    if (!isActive) return; // Only scroll when test is active
    
    // no skip - we will handle boosted paragraph scrolling via paraScrollUntilWordsRef
    
    const container = originalTextRef.current;
    const originalText = testContent.text;
    
    // Strip HTML tags while preserving paragraph markers for accurate word counting
    const plainText = stripHtmlPreserveParagraphs(originalText);

    // Count paragraphs typed by user and words to detect Enter and set boosted window
    const processedTyped = replaceNewlinesWithParaToken(typedText);
    const paraCount = (processedTyped.match(/\[\[PARA\]\]/g) || []).length;

    // Count words typed by user (treat newlines as PARA_TOKEN)
    const typedWords = processedTyped.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN).length;

    // Check if a new paragraph was added (user pressed Enter)
    const isNewParagraph = paraCount > lastParaCountRef.current;
    if (isNewParagraph) {
      lastParaCountRef.current = paraCount;
      // Boost scrolling for next 5 typed words OR for 1.5s, whichever is longer
      paraScrollUntilWordsRef.current = typedWords + 5;
      paraScrollUntilTimeRef.current = Date.now() + 1500; // 1.5 seconds
    }
    const originalWords = plainText.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN);
    const totalOriginalWords = originalWords.length;
    
    if (totalOriginalWords === 0) return;
    
    // Calculate scroll position based on word progress
    const scrollableHeight = container.scrollHeight - container.clientHeight;
    const progress = Math.min(typedWords / totalOriginalWords, 1);
    
    // Target position: current word should appear near top (20% from top)
    // This makes content scroll up as user types (bottom to top feel)
    const targetScrollPosition = Math.max(0, progress * scrollableHeight);
    
    const currentScroll = container.scrollTop;
    let diff = targetScrollPosition - currentScroll;
    
    // Determine if boosted scroll should be active (typed-word window or time window)
    const now = Date.now();
    const boostedActive = (typedWords <= paraScrollUntilWordsRef.current) || (now <= paraScrollUntilTimeRef.current);
    const scrollFactor = boostedActive ? 0.8 : 0.35;

    // Only auto-scroll if difference is significant (more than 2px) when not boosted
    if (Math.abs(diff) < 2 && !boostedActive) return;
    
    // If user has manually scrolled, only do "catch-up" scrolling
    // when they fall more than 30% behind the target position
    if (userScrolled && !boostedActive) {
      const lagThreshold = scrollableHeight * 0.3;
      if (diff < lagThreshold) return; // User is ahead or close enough, don't interfere
    }
    
    // Apply scroll with appropriate factor (higher for paragraph breaks)
    let newScroll = currentScroll + diff * scrollFactor;
    

    
    // Mark as programmatic scroll to avoid triggering manual scroll detection
    isAutoScrollingRef.current = true;
    container.scrollTop = newScroll;
    lastScrollTopRef.current = newScroll;
    
  }, [typedText, testContent, userScrolled, isActive, autoScrollEnabled]);

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

  // Highlight the next word to type
  const getHighlightedContent = () => {
    if (!testContent || testContent.type !== 'typing') return testContent?.text || '';

    // If highlighter is disabled, return original content as-is
    if (!highlighterEnabled) {
      return testContent.text;
    }

    // Extract plain text to find words, preserving paragraph tokens
    const plainText = stripHtmlPreserveParagraphs(testContent.text);
    const words = plainText.trim().split(/\s+/).filter(w => w && w !== PARA_TOKEN);

    // Determine which word index corresponds to the word currently being typed
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

    // For Hindi and other scripts, use a more robust approach:
    // Replace the exact target word string, counting occurrences
    // We need to be careful to only replace in text content, not in HTML tags
    
    let wordOccurrenceCount = 0;
    let foundTargetWord = false;
    
    const htmlContent = testContent.text;
    
    // Split by HTML tags, process only text nodes
    const parts = htmlContent.split(/(<[^>]+>)/);
    
    const processedParts = parts.map((part) => {
      if (part.startsWith('<')) {
        // This is an HTML tag, return as-is
        return part;
      }
      
      if (foundTargetWord || !part) {
        // Already found the word, or empty part
        return part;
      }
      
      // This is a text node - count words and replace
      const textWords = part.split(/(\s+)/); // Split preserving whitespace
      
      return textWords.map((segment) => {
        if (foundTargetWord || !segment || /^\s+$/.test(segment)) {
          // Already found, or just whitespace
          return segment;
        }
        
        // Check if this segment is a word and matches our target
        if (segment === targetWord) {
          if (wordOccurrenceCount === currentIndex) {
            foundTargetWord = true;
            return `<span style="background-color: #fbbf24; padding: 2px 4px; border-radius: 2px; font-weight: 500;">${segment}</span>`;
          }
          wordOccurrenceCount++;
        } else if (!/^\s+$/.test(segment)) {
          // Count non-whitespace segments as word occurrences for proper indexing
          wordOccurrenceCount++;
        }
        
        return segment;
      }).join('');
    }).join('');

    return processedParts;
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

            {/* Auto-scroll Toggle for Typing Tests */}
            {testContent.type === 'typing' && autoScrollEnabled !== null && (
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

            {testContent.type === 'typing' && (
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
        
        {/* Shorthand Audio Controls - More Visible for All Devices */}
        {testContent.type === 'shorthand' && (video60Available || video80Available || video100Available || video120Available) && (
           <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-2 border-orange-300 shadow-md shrink-0">
             <CardContent className="p-4">
               <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div className="flex items-center gap-3 flex-1">
                   <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full text-orange-600 dark:text-orange-300 flex-shrink-0">
                     <Music size={24} />
                   </div>
                   <div>
                     <h3 className="font-semibold text-lg text-orange-900 dark:text-orange-100">Dictation Audio</h3>
                     <p className="text-sm text-orange-700 dark:text-orange-200">Select audio speed below and click "Open Audio" to play</p>
                   </div>
                 </div>
                 
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                   <div className="flex items-center gap-2">
                     <label className="text-sm font-semibold text-orange-900 dark:text-orange-100 whitespace-nowrap">Audio Speed:</label>
                     <Select value={selectedVideoWpm} onValueChange={(val) => setSelectedVideoWpm(val as "60" | "80" | "100" | "120")}>
                       <SelectTrigger className="w-28 h-10 bg-white dark:bg-slate-800">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="60" disabled={!video60Available}>60 WPM</SelectItem>
                         <SelectItem value="80" disabled={!video80Available}>80 WPM</SelectItem>
                         <SelectItem value="100" disabled={!video100Available}>100 WPM</SelectItem>
                         <SelectItem value="120" disabled={!video120Available}>120 WPM</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   
                   {/* Audio Link Button - Prominent and Clickable */}
                   {selectedVideoUrl ? (
                     <a 
                       href={selectedVideoUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap"
                     >
                       <Music size={16} />
                       Open Audio
                     </a>
                   ) : (
                     <Button disabled className="whitespace-nowrap">
                       <Music size={16} />
                       Audio Unavailable
                     </Button>
                   )}
                 </div>
               </div>

               {/* Audio Not Found Message */}
               {!selectedVideoUrl && (
                 <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md mt-3">
                   <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                   <span className="text-sm text-red-700 dark:text-red-200 font-medium">Audio not available for {selectedVideoWpm} WPM. Please select a different speed.</span>
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
                className={cn("leading-relaxed select-none transition-all", fontClass)}
                style={{ fontSize: `${fontSize}px` }}
                dangerouslySetInnerHTML={{ __html: getHighlightedContent() }}
              />
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