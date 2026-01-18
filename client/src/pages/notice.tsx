import { useState } from "react";
import { useNotices } from "@/lib/hooks/useNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Download, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function NoticesPage() {
  const { notices, isLoading } = useNotices();
  const [visibleNoticesCount, setVisibleNoticesCount] = useState(20); // Show 20 initially
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Notices are already sorted by latest first from the API
  const visibleNotices = notices.slice(0, visibleNoticesCount);
  const hasMore = visibleNoticesCount < notices.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleNoticesCount((prev) => prev + 10);
      setIsLoadingMore(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Bell className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Notices
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {notices.length} total announcement{notices.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-yellow-600 mb-3" />
            <p className="text-muted-foreground">Loading notices...</p>
          </div>
        ) : notices.length === 0 ? (
          <Card className="border-2 border-dashed shadow-lg">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="h-16 w-16 text-yellow-200 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Notices Available
              </h3>
              <p className="text-muted-foreground max-w-sm">
                There are no notices at the moment. Check back soon for updates!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleNotices.map((notice) => (
              <Card
                key={notice.id}
                className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl text-gray-900 break-words">
                        {notice.heading}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {format(new Date(notice.createdAt), "MMMM d, yyyy h:mm a")}
                      </p>
                    </div>
                    {notice.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = notice.pdfUrl!;
                          link.download = "notice.pdf";
                          link.click();
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {notice.content}
                  </p>
                </CardContent>
              </Card>
            ))}

            {/* Load More Section */}
            {hasMore && (
              <div className="flex justify-center pt-8">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-lg"
                  size="lg"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Notices
                      <span className="ml-2 text-sm opacity-90">
                        ({Math.min(10, notices.length - visibleNoticesCount)} more)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Completion Message */}
            {!hasMore && notices.length > 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  ✓ You're all caught up! You've seen all {notices.length} notice
                  {notices.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
