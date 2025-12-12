import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { calculateTypingMetrics, calculateShorthandMetrics, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Timer, AlertCircle, Save, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TypingTestPage() {
  const [, params] = useRoute("/test/:id");
  const [, setLocation] = useLocation();
  const { content, currentUser, submitResult } = useMockStore();
  const { toast } = useToast();

  const testContent = content.find(c => c.id === params?.id);
  
  const [typedText, setTypedText] = useState("");
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [backspaces, setBackspaceCount] = useState(0);
  
  // Timer Reference
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
    }
  }, [testContent]);

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

  // Prevent back navigation or refresh warning? 
  // For prototype, we'll skip complex navigation blocking.

  const startTest = () => {
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

  const handleSubmit = () => {
    if (!testContent || !currentUser) return;

    let metrics;
    if (testContent.type === 'typing') {
      metrics = calculateTypingMetrics(testContent.text, typedText, testContent.duration, backspaces);
    } else {
      metrics = calculateShorthandMetrics(testContent.text, typedText, testContent.duration);
    }

    submitResult({
      studentId: currentUser.studentId || currentUser.id,
      studentName: currentUser.name,
      contentId: testContent.id,
      contentTitle: testContent.title,
      contentType: testContent.type,
      typedText: typedText,
      metrics: {
        ...metrics,
        time: testContent.duration,
        backspaces: backspaces // Store raw backspaces too
      }
    });

    toast({
      title: "Test Submitted!",
      description: "Your results have been recorded.",
    });

    // Redirect to dashboard after short delay
    setTimeout(() => {
      setLocation("/student");
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isActive) return;
    if (e.key === 'Backspace') {
      setBackspaceCount(prev => prev + 1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!testContent) {
    return <div className="p-8">Test not found</div>;
  }

  // Split text for Typing Test view
  // We want to show original content but prevent copy paste (CSS user-select: none)
  
  return (
    <div className="h-full flex flex-col space-y-4 max-h-[calc(100vh-4rem)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold">{testContent.title}</h2>
          <p className="text-sm text-muted-foreground capitalize">{testContent.type} Test - {testContent.duration} Min</p>
        </div>
        
        <div className={cn(
          "text-3xl font-mono font-bold flex items-center gap-2",
          timeLeft < 60 ? "text-red-500 animate-pulse" : "text-primary"
        )}>
          <Timer size={32} />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        {/* Original Content Area */}
        {testContent.type === 'typing' && (
           <Card className="flex flex-col h-full overflow-hidden border-2">
            <CardHeader className="py-3 bg-muted/50 border-b">
              <CardTitle className="text-sm font-medium text-muted-foreground">Original Text</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 select-none custom-scrollbar">
              <div className="text-lg leading-relaxed font-serif text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {testContent.text}
              </div>
            </CardContent>
          </Card>
        )}
        
        {testContent.type === 'shorthand' && (
          <div className="flex flex-col justify-center items-center h-full p-8 border-2 border-dashed rounded-lg bg-muted/20 text-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
               <EyeOff className="h-10 w-10 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Content Hidden</h3>
            <p className="text-muted-foreground max-w-sm">
              This is a Shorthand transcription test. Please type from your provided hard copy. 
              The content is hidden on screen.
            </p>
          </div>
        )}

        {/* Typing Area */}
        <Card className={cn("flex flex-col h-full overflow-hidden border-2", testContent.type === 'shorthand' ? "md:col-span-2" : "")}>
          <CardHeader className="py-3 bg-muted/50 border-b flex flex-row justify-between items-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Input</CardTitle>
             {!isActive && !isFinished && (
               <div className="text-xs text-blue-600 font-medium animate-bounce">Click "Start" below to begin</div>
             )}
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
             <Textarea
              id="typing-area"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isActive}
              className="w-full h-full resize-none p-4 text-lg font-mono border-0 focus-visible:ring-0 rounded-none bg-transparent"
              placeholder={isActive ? "Start typing here..." : "Waiting to start..."}
              spellCheck={false}
              autoComplete="off"
              onPaste={(e) => e.preventDefault()} // Disable paste
             />
             
             {/* Overlay for inactive state */}
             {!isActive && !isFinished && (
               <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                 <Button size="lg" onClick={startTest} className="text-lg px-8 py-6 shadow-xl">
                   Start Test
                 </Button>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
      
      {/* Footer Controls */}
      <div className="shrink-0 flex justify-end">
         {isActive && (
            <Button variant="destructive" onClick={finishTest} className="gap-2">
              <Save size={16} /> Submit Test
            </Button>
         )}
      </div>

       {/* Results Modal / Overlay (Simplified as alert/toast for now, full report on dashboard) */}
    </div>
  );
}
