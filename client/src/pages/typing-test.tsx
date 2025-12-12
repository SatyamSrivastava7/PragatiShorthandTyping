import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useMockStore } from "@/lib/store";
import { calculateTypingMetrics, calculateShorthandMetrics, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Timer, EyeOff, Save, CheckCircle, Music, ArrowLeft, Settings } from "lucide-react";
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
  const [userLanguage, setUserLanguage] = useState<'english' | 'hindi'>('english');
  
  // Timer Reference
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (testContent) {
      setTimeLeft(testContent.duration * 60);
      // Default to test content language, but allow override
      if (testContent.language) setUserLanguage(testContent.language as 'english' | 'hindi');
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
      language: userLanguage, // Use user selected language preference
      metrics: {
        ...metrics,
        time: testContent.duration,
        backspaces: backspaces
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

  // Font family based on language selection
  const typingFontClass = userLanguage === 'hindi' ? 'font-[Mangal]' : 'font-mono';
  const contentFontClass = testContent.language === 'hindi' ? 'font-[Mangal]' : 'font-serif';

  return (
    <div className="h-full flex flex-col space-y-4 max-h-[calc(100vh-4rem)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/student">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold truncate max-w-[200px] md:max-w-md">{testContent.title}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
               <span className="capitalize">{testContent.type} Test</span>
               <span>•</span>
               <span>{testContent.duration} Min</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <Select value={userLanguage} onValueChange={(v: any) => setUserLanguage(v)} disabled={isActive}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="hindi">Hindi (Mangal)</SelectItem>
              </SelectContent>
            </Select>
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

      {/* Main Workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        
        {/* Original Content / Shorthand Info */}
        {testContent.type === 'typing' ? (
           <Card className="flex flex-col h-full overflow-hidden border-2 shadow-sm">
            <CardHeader className="py-3 bg-muted/50 border-b">
              <CardTitle className="text-sm font-medium text-muted-foreground">Original Text</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-auto bg-white dark:bg-zinc-900 select-none custom-scrollbar">
              <div className={cn("text-lg leading-relaxed whitespace-pre-wrap select-none", contentFontClass)}>
                {testContent.text}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4 h-full">
            <Alert className="bg-orange-50 border-orange-200">
              <EyeOff className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">Content Hidden</AlertTitle>
              <AlertDescription className="text-orange-700">
                This is a shorthand test. Please transcribe from your hard copy or audio.
              </AlertDescription>
            </Alert>
            
            {testContent.mediaUrl && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Music size={16} /> Audio Dictation
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                  <audio 
                    id="shorthand-audio" 
                    src={testContent.mediaUrl} 
                    controls 
                    className="w-full"
                    controlsList="nodownload" 
                  />
                </CardContent>
              </Card>
            )}
            
            <div className="flex-1 bg-muted/10 rounded-lg border-2 border-dashed flex items-center justify-center p-8 text-center text-muted-foreground">
              <p>Focus on your transcription.</p>
            </div>
          </div>
        )}

        {/* Typing Area */}
        <Card className={cn("flex flex-col h-full overflow-hidden border-2 shadow-sm", testContent.type === 'shorthand' ? "md:col-span-1" : "")}>
          <CardHeader className="py-3 bg-muted/50 border-b flex flex-row justify-between items-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Input ({userLanguage})</CardTitle>
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
                "w-full h-full resize-none p-4 text-lg border-0 focus-visible:ring-0 rounded-none bg-transparent leading-relaxed", 
                typingFontClass
              )}
              placeholder={isActive ? "Start typing here..." : "Waiting to start..."}
              spellCheck={false}
              autoComplete="off"
              onPaste={(e) => e.preventDefault()}
             />
             
             {/* Overlay for inactive state */}
             {!isActive && !isFinished && (
               <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                 <Button size="lg" onClick={startTest} className="text-lg px-8 py-6 shadow-xl hover:scale-105 transition-transform">
                   Start Test
                 </Button>
               </div>
             )}
          </CardContent>
        </Card>
      </div>
      
      {/* Footer Controls */}
      <div className="shrink-0 flex justify-end pb-2">
         {isActive && (
            <Button variant="destructive" onClick={finishTest} className="gap-2 shadow-lg">
              <Save size={16} /> Submit Test Early
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
