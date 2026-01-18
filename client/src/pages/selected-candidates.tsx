import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSelectedCandidates } from "@/lib/hooks";
import { ArrowLeft } from "lucide-react";

export default function SelectedCandidatesPage() {
  const { candidates: selectedCandidates } = useSelectedCandidates(true); // Selected candidates page always enabled

  // Sort candidates by batch year in descending order
  const sortedCandidates = [...selectedCandidates].sort((a, b) => {
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    return yearB - yearA;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">Our Selected Candidates</h1>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedCandidates.map((student) => (
            <Card 
              key={student.id} 
              className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-b from-white to-blue-50/50"
              data-testid={`card-candidate-${student.id}`}
            >
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-md mb-4 bg-gray-100">
                  <img src={student.imageUrl} alt={student.name} className="h-full w-full object-cover" />
                </div>
                <h3 className="font-bold text-lg text-primary">{student.name}</h3>
                <p className="text-sm font-medium text-gray-700 mt-1">{student.designation}</p>
                <p className="text-xs text-muted-foreground mt-2 bg-white px-3 py-1 rounded-full border">Batch {student.year}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedCandidates.length === 0 && (
          <div className="text-center py-16" data-testid="text-empty">
            <p className="text-muted-foreground text-lg">No selected candidates to display.</p>
          </div>
        )}
      </div>
    </div>
  );
}
