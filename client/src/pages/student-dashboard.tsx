import { useMockStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format, isSameDay } from "date-fns";
import { PlayCircle, CheckCircle } from "lucide-react";

export default function StudentDashboard() {
  const { content, results, currentUser } = useMockStore();
  const [, setLocation] = useLocation();

  const today = new Date();
  
  // Filter content: Enabled AND Date is Today
  const todaysTests = content.filter(c => {
    // Parse dateFor (YYYY-MM-DD)
    const contentDate = new Date(c.dateFor);
    // Check if same day as local today
    // Note: This relies on local time, which is fine for mockup.
    // Prompt says: "User should be able to see only content of today... Don't show the uploaded date to the user"
    const isToday = isSameDay(contentDate, today);
    return c.isEnabled && isToday;
  });

  const getResultForContent = (contentId: string) => {
    return results.find(r => r.contentId === contentId && r.studentId === currentUser?.id);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Today's Assignments</h1>
        <p className="text-muted-foreground">Select a test to begin. Good luck!</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {todaysTests.length > 0 ? (
          todaysTests.map((test) => {
            const result = getResultForContent(test.id);
            const isCompleted = !!result;

            return (
              <Card key={test.id} className="flex flex-col border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl">{test.title}</CardTitle>
                  <CardDescription className="capitalize font-medium text-primary">
                    {test.type} Test
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Duration: <span className="font-semibold text-foreground">{test.duration} Minutes</span></p>
                    {test.type === 'shorthand' && (
                      <p className="text-orange-600 bg-orange-50 inline-block px-2 py-1 rounded-sm text-xs">
                        Requires Hard Copy
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t bg-muted/20">
                  {isCompleted ? (
                    <Button variant="outline" className="w-full cursor-default bg-green-50 hover:bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-2 h-4 w-4" /> Completed
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={() => setLocation(`/test/${test.id}`)}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
            <div className="bg-muted rounded-full p-4 mb-4">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No tests available for today</h3>
            <p className="text-muted-foreground mt-2">Please check back later or contact your administrator.</p>
          </div>
        )}
      </div>

      {/* Recent Results Section for Student History */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Your Recent History</h2>
        <div className="space-y-4">
          {results
            .filter(r => r.studentId === currentUser?.studentId || r.studentId === currentUser?.id)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .map(result => (
              <Card key={result.id} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{result.contentTitle}</h4>
                  <p className="text-sm text-muted-foreground">{format(new Date(result.submittedAt), "PPP")}</p>
                </div>
                <div className="text-right">
                  {result.contentType === 'typing' ? (
                     <div className="text-sm">
                       <span className="font-bold text-primary">{result.metrics.netSpeed} WPM</span>
                       <span className="mx-2 text-muted-foreground">|</span>
                       <span className="text-muted-foreground">{result.metrics.mistakes} Mistakes</span>
                     </div>
                  ) : (
                    <div className="text-sm">
                      <span className={result.metrics.result === 'Pass' ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                        {result.metrics.result}
                      </span>
                      <span className="mx-2 text-muted-foreground">|</span>
                      <span className="text-muted-foreground">{result.metrics.mistakes} Mistakes</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
           {results.filter(r => r.studentId === currentUser?.studentId || r.studentId === currentUser?.id).length === 0 && (
             <p className="text-muted-foreground">No history yet.</p>
           )}
        </div>
      </div>
    </div>
  );
}
