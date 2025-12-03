import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateTypingStats, calculateShorthandStats } from "@/lib/utils";
import { Play, ArrowLeft, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TypingTestPage() {
  const [, params] = useRoute("/test/:id");
  const [, setLocation] = useLocation();
  const { assignments, currentUser, addResult } = useStore();
  const { toast } = useToast();
  
  const assignment = assignments.find(a => a.id === params?.id);

  const [typedContent, setTypedContent] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [backspaces, setBackspaces] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize timer
  useEffect(() => {
    if (assignment) {
      setTimeLeft(assignment.durationMinutes * 60);
    }
  }, [assignment]);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      finishTest();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Backspace tracking
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      setBackspaces(prev => prev + 1);
    }
  };

  // Disable pasting
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    toast({
      title: "No Cheating!",
      description: "Pasting is disabled for this test.",
      variant: "destructive",
    });
  };

  const startTest = () => {
    setIsActive(true);
    // Short timeout to allow render before focus
    setTimeout(() => textareaRef.current?.focus(), 10);
  };

  const finishTest = () => {
    setIsActive(false);
    setIsFinished(true);

    if (!assignment || !currentUser) return;

    const timeAllocated = assignment.durationMinutes;
    
    let resultData;

    if (assignment.type === 'typing') {
       const stats = calculateTypingStats(assignment.content, typedContent, timeAllocated, backspaces);
       resultData = {
         ...stats, // accuracy, mismatches(renamed inside), backspaces, grossSpeed, netSpeed
         mismatches: stats.mistakes
       };
    } else {
       // Shorthand
       const contentWordCount = assignment.content.trim().split(/\s+/).length;
       const stats = calculateShorthandStats(assignment.content, typedContent, contentWordCount);
       resultData = {
         mismatches: stats.mistakes,
         result: stats.result
       };
    }

    addResult({
      assignmentId: assignment.id,
      userId: currentUser.id,
      username: currentUser.username,
      typedContent,
      dateTaken: Date.now(),
      totalChars: typedContent.length,
      type: assignment.type,
      ...resultData
    });

    toast({
      title: "Test Completed!",
      description: "Your results have been submitted.",
    });
  };

  if (!assignment) return <div>Assignment not found</div>;

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
        <div className="h-24 w-24 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center mb-4">
          <Timer className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-bold">Test Completed!</h2>
        <p className="text-muted-foreground">Your results have been recorded successfully.</p>
        
        <div className="flex justify-center gap-4 mt-8">
          <Button onClick={() => setLocation('/dashboard')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Format timer
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isShorthand = assignment.type === 'shorthand';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div>
          <h2 className="font-bold text-lg">{assignment.title}</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Duration: {assignment.durationMinutes} min</p>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-bold">
              {isShorthand ? 'Shorthand' : 'Typing'}
            </span>
          </div>
        </div>
        <div className={`text-4xl font-mono font-bold ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
          {formattedTime}
        </div>
        {!isActive ? (
          <Button size="lg" onClick={startTest} className="gap-2">
            <Play className="h-4 w-4" /> Start Test
          </Button>
        ) : (
          <Button variant="destructive" onClick={finishTest}>
            End Test Early
          </Button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
        {/* Source Text (Hidden for Shorthand) */}
        {!isShorthand && (
          <div className="flex flex-col gap-2 h-full min-h-0">
            <div className="font-medium text-sm text-muted-foreground">Source Text</div>
            <div className="bg-muted/30 border rounded-lg p-6 overflow-y-auto h-full font-mono text-lg leading-relaxed custom-scrollbar select-none">
              {assignment.content}
            </div>
          </div>
        )}

        {/* Typing Area - Full width for Shorthand */}
        <div className={`flex flex-col gap-2 h-full min-h-0 ${isShorthand ? 'md:col-span-2' : ''}`}>
          <div className="font-medium text-sm text-muted-foreground">
             {isShorthand ? 'Transcription Area (Hard Copy)' : 'Your Input'}
          </div>
          <textarea
            ref={textareaRef}
            className={`flex-1 w-full resize-none rounded-lg border bg-background p-6 font-mono text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder={isActive ? "Start typing here..." : "Click 'Start Test' to begin..."}
            value={typedContent}
            onChange={(e) => setTypedContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isActive}
            onPaste={handlePaste}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      </div>
    </div>
  );
}
