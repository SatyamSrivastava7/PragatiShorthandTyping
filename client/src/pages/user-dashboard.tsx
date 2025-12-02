import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Keyboard, CalendarCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function UserDashboard() {
  const { assignments, currentUser } = useStore();
  const [, setLocation] = useLocation();

  const today = new Date().toISOString().split('T')[0];
  
  // Filter for today's assignments (mock logic: show all for demo purposes, but highlight today's)
  // Real app would filter: a.date === today
  const todaysAssignments = assignments.filter(a => a.date === today);
  const otherAssignments = assignments.filter(a => a.date !== today);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Hello, {currentUser?.username}</h2>
        <p className="text-muted-foreground">Ready to improve your typing speed today?</p>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Today's Assignments ({todaysAssignments.length})
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {todaysAssignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} setLocation={setLocation} isToday={true} />
          ))}
          
          {todaysAssignments.length === 0 && (
            <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/10">
              No assignments scheduled for today. Check back later or practice with past assignments.
            </div>
          )}
        </div>

        {otherAssignments.length > 0 && (
          <>
            <h3 className="text-xl font-semibold flex items-center gap-2 mt-8">
              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
              Other Practice Material
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {otherAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} setLocation={setLocation} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, setLocation, isToday }: { assignment: any, setLocation: any, isToday?: boolean }) {
  return (
    <Card className={`transition-all hover:border-primary/50 ${isToday ? 'shadow-lg shadow-primary/5 border-primary/20' : 'opacity-80 hover:opacity-100'}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="line-clamp-1">{assignment.title}</CardTitle>
            <CardDescription>{formatDate(assignment.date)}</CardDescription>
          </div>
          <Badge variant={isToday ? "default" : "secondary"} className="ml-2">
            {assignment.durationMinutes} min
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted/30 p-3 rounded-md border">
          {assignment.content}
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full group" onClick={() => setLocation(`/test/${assignment.id}`)} variant={isToday ? "default" : "outline"}>
          <Keyboard className="mr-2 h-4 w-4 group-hover:animate-pulse" />
          Start Test
        </Button>
      </CardFooter>
    </Card>
  );
}

function HistoryIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}
