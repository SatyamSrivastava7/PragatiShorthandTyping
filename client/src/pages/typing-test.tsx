import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useAuth, useContentById, useResults, useSettings } from "@/lib/hooks";
import { calculateTypingMetrics, calculateShorthandMetrics, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Timer, EyeOff, Save, CheckCircle, Music, ArrowLeft, Settings, Maximize, Minimize, Type, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

export default function TypingTestPage() {
  const [, params] = useRoute("/test/:id");
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { data: testContent, isLoading: isContentLoading } = useContentById(params?.id ? Number(params.id) : undefined);
  const { createResult } = useResults();
  const { settings } = useSettings();
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
  
  // Timer Reference
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Time's up!
      finishTest();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeLeft]);
  
  // Auto-scroll logic (controlled by admin setting)
  useEffect(() => {
    const autoScrollEnabled = settings?.autoScrollEnabled ?? true;
    if (autoScrollEnabled && testContent?.type === 'typing' && originalTextRef.current) {
      // Very basic sync: Scroll original text based on progress
      const totalLength = testContent.text.length;
      const currentLength = typedText.length;
      const progress = currentLength / totalLength;
      
      const scrollHeight = originalTextRef.current.scrollHeight;
      const clientHeight = originalTextRef.current.clientHeight;
      
      // Scroll proportional to progress
      originalTextRef.current.scrollTop = (scrollHeight - clientHeight) * progress;
    }
  }, [typedText, testContent, settings?.autoScrollEnabled]);

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

  const finishTest = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsActive(false);
    setIsFinished(true);
    
    // Auto submit logic
    handleSubmit();
  };

  const handleSubmit = async () => {
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
    if (testContent.type === 'typing') {
      metrics = calculateTypingMetrics(testContent.text, typedText, testContent.duration, backspaces);
    } else {
      metrics = calculateShorthandMetrics(testContent.text, typedText, testContent.duration);
    }

    // Determine Pass/Fail based on 5% mistake rule
    // More than 5% mistakes = Fail, 5% or less = Pass
    const mistakePercentage = metrics.words > 0 ? (metrics.mistakes / metrics.words) * 100 : 0;
    const result: 'Pass' | 'Fail' = mistakePercentage > 5 ? 'Fail' : 'Pass';

    try {
      await createResult({
        contentId: testContent.id,
        typedText: typedText,
        words: metrics.words,
        time: testContent.duration,
        mistakes: String(metrics.mistakes),
        backspaces: backspaces,
        grossSpeed: String(metrics.grossSpeed),
        netSpeed: String(metrics.netSpeed),
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isActive) return;
    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
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
        {testContent.type === 'shorthand' && testContent.mediaUrl && (
           <Card className="bg-muted/30 border-2 border-orange-200 shrink-0">
             <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                   <Music size={24} />
                 </div>
                 <div>
                   <h3 className="font-semibold text-lg">Dictation Audio</h3>
                   <p className="text-sm text-muted-foreground">Listen carefully, write on your shorthand pad, then type below.</p>
                 </div>
               </div>
               <audio 
                 id="shorthand-audio" 
                 src={testContent.mediaUrl} 
                 controls 
                 className="w-full md:w-96"
                 controlsList="nodownload" 
               />
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