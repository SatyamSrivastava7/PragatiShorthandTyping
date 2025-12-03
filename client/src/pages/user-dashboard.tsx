import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Keyboard, FileText } from "lucide-react";

export default function UserDashboard() {
  const { assignments, currentUser } = useStore();
  const [, setLocation] = useLocation();

  // Only show enabled assignments
  const activeAssignments = assignments.filter(a => a.isEnabled);
  const typingAssignments = activeAssignments.filter(a => a.type === 'typing');
  const shorthandAssignments = activeAssignments.filter(a => a.type === 'shorthand');

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Hello, {currentUser?.username}</h2>
        <p className="text-muted-foreground">Your scheduled tests for today.</p>
      </div>

      <div className="space-y-8">
        {/* Typing Tests Section */}
        <div>
            <h3 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Keyboard className="h-5 w-5 text-primary" />
              Typing Tests
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {typingAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} setLocation={setLocation} />
              ))}
              {typingAssignments.length === 0 && (
                <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/10">
                  No typing tests currently active.
                </div>
              )}
            </div>
        </div>

        {/* Shorthand Tests Section */}
        <div>
            <h3 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              Shorthand Tests
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {shorthandAssignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} setLocation={setLocation} isShorthand />
              ))}
              {shorthandAssignments.length === 0 && (
                <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/10">
                  No shorthand tests currently active.
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, setLocation, isShorthand }: { assignment: any, setLocation: any, isShorthand?: boolean }) {
  return (
    <Card className="transition-all hover:border-primary/50 shadow-lg shadow-primary/5 border-primary/20">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="line-clamp-1">{assignment.title}</CardTitle>
            {/* Date hidden as per requirement */}
          </div>
          <Badge variant="default" className="ml-2">
            {assignment.durationMinutes} min
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isShorthand ? (
             <div className="flex items-center justify-center h-20 bg-muted/30 rounded-md border border-dashed text-muted-foreground italic">
                Content hidden for Shorthand Test
             </div>
        ) : (
            <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted/30 p-3 rounded-md border">
              {assignment.content}
            </p>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full group" onClick={() => setLocation(`/test/${assignment.id}`)}>
          <Keyboard className="mr-2 h-4 w-4 group-hover:animate-pulse" />
          Start {isShorthand ? 'Shorthand' : 'Typing'} Test
        </Button>
      </CardFooter>
    </Card>
  );
}
