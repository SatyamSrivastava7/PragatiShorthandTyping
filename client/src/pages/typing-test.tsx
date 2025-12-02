import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateAccuracy, calculateWPM } from "@/lib/utils";
import { Play, RotateCcw, ArrowLeft, Timer } from "lucide-react";
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
    textareaRef.current?.focus();
  };

  const finishTest = () => {
    setIsActive(false);
    setIsFinished(true);

    if (!assignment || !currentUser) return;

    const timeSpentMinutes = assignment.durationMinutes - (timeLeft / 60);
    // If time ran out, they used full duration. If they clicked finish early (optional), calculate actual time.
    // For this req, "once the timer ends the results should get generated". So we assume full duration or until timeout.
    // Let's use full duration for WPM calculation if it times out.
    
    const calcTime = assignment.durationMinutes; // Standardize on the full time allocated for the test for fairness? 
    // Or should it be time elapsed? Usually WPM is (chars / 5) / time_elapsed.
    // If the timer ENDS, time_elapsed is the full duration.
    
    const { accuracy, mismatches } = calculateAccuracy(assignment.content, typedContent);
    const wpm = calculateWPM(typedContent.length, calcTime);

    addResult({
      assignmentId: assignment.id,
      userId: currentUser.id,
      username: currentUser.username,
      typedContent,
      accuracy,
      wpm,
      mismatches,
      totalChars: typedContent.length,
      dateTaken: Date.now(),
    });

    toast({
      title: "Test Completed!",
      description: "Your results have been submitted to the admin.",
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
        
        <div className="grid grid-cols-3 gap-4 mt-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">WPM</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{calculateWPM(typedContent.length, assignment.durationMinutes)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Accuracy</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{calculateAccuracy(assignment.content, typedContent).accuracy}%</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Mismatches</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-orange-600">{calculateAccuracy(assignment.content, typedContent).mismatches}</div></CardContent>
          </Card>
        </div>

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

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div>
          <h2 className="font-bold text-lg">{assignment.title}</h2>
          <p className="text-sm text-muted-foreground">Duration: {assignment.durationMinutes} min</p>
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
        {/* Source Text */}
        <div className="flex flex-col gap-2 h-full min-h-0">
          <div className="font-medium text-sm text-muted-foreground">Source Text</div>
          <div className="bg-muted/30 border rounded-lg p-6 overflow-y-auto h-full font-mono text-lg leading-relaxed custom-scrollbar select-none">
            {assignment.content}
          </div>
        </div>

        {/* Typing Area */}
        <div className="flex flex-col gap-2 h-full min-h-0">
          <div className="font-medium text-sm text-muted-foreground">Your Input</div>
          <textarea
            ref={textareaRef}
            className={`flex-1 w-full resize-none rounded-lg border bg-background p-6 font-mono text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary ${!isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
            placeholder={isActive ? "Start typing here..." : "Click 'Start Test' to begin typing..."}
            value={typedContent}
            onChange={(e) => setTypedContent(e.target.value)}
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
