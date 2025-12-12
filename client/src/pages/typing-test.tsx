import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { calculateTypingMetrics, calculateShorthandMetrics, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Timer, AlertCircle, Save, EyeOff, CheckCircle, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const [showResultModal, setShowResultModal] = useState(false);
  
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
    
    // Play audio if available and shorthand
    if (testContent?.type === 'shorthand' && testContent.mediaUrl) {
      const audio = document.getElementById('shorthand-audio') as HTMLAudioElement;
      if (audio) {
        audio.play().catch(e => console.log("Audio play failed", e));
      }
    }
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
      originalText: testContent.text, // Save original snapshot
      language: testContent.language,
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

    setShowResultModal(true);
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

  // Font family based on language
  const contentFontClass = testContent.language === 'hindi' ? 'font-[Mangal]' : 'font-serif';
  const typingFontClass = testContent.language === 'hindi' ? 'font-[Mangal]' : 'font-mono';

  return (
    <div className="h-full flex flex-col space-y-4 max-h-[calc(100vh-4rem)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0">
        <div>
          <h2 className="text-xl font-bold">{testContent.title}</h2>
          <p className="text-sm text-muted-foreground capitalize">
            {testContent.type} Test - {testContent.duration} Min - {testContent.language || 'English'}
          </p>
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
              <div className={cn("text-lg leading-relaxed whitespace-pre-wrap", contentFontClass)}>
                {testContent.text}
              </div>
            </CardContent>
          </Card>
        )}
        
        {testContent.type === 'shorthand' && (
          <div className="flex flex-col justify-center items-center h-full p-8 border-2 border-dashed rounded-lg bg-muted/20 text-center relative">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
               <EyeOff className="h-10 w-10 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Content Hidden</h3>
            <p className="text-muted-foreground max-w-sm">
              This is a Shorthand transcription test. Please type from your provided hard copy. 
              The content is hidden on screen.
            </p>
            
            {testContent.mediaUrl && (
              <div className="mt-6 w-full max-w-sm bg-card p-4 rounded border shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-blue-600 font-medium">
                  <Music size={16} /> Audio Transcription
                </div>
                <audio 
                  id="shorthand-audio" 
                  src={testContent.mediaUrl} 
                  controls 
                  className="w-full"
                  controlsList="nodownload" 
                />
              </div>
            )}
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
              className={cn(
                "w-full h-full resize-none p-4 text-lg border-0 focus-visible:ring-0 rounded-none bg-transparent", 
                typingFontClass
              )}
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
          <div className="flex items-center space-x-2">
            
          </div>
          <DialogFooter className="sm:justify-center">
            <Button type="button" variant="default" className="w-full" onClick={() => setLocation('/student')}>
              Back to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
