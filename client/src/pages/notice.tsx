import { useEffect, useState } from "react";
import { useNotices } from "@/lib/hooks/useNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Download, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

const PAGE_LIMIT = 20;

export default function NoticesPage() {
  const [offset, setOffset] = useState(0);
  const [pages, setPages] = useState<any[]>([]); // aggregated pages
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expandedNotices, setExpandedNotices] = useState<Set<string>>(new Set());

  const { notices: pageNotices, isLoading } = useNotices({ enabled: true, limit: PAGE_LIMIT, offset });

  // when a page arrives, append or replace depending on offset
  useEffect(() => {
    if (!pageNotices) return;

    if (offset === 0) {
      setPages(pageNotices);
    } else if (pageNotices.length > 0) {
      setPages((prev) => [...prev, ...pageNotices]);
    }

    // stop the load-more spinner when page finishes
    setIsLoadingMore(false);
  }, [pageNotices, offset]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setOffset((prev) => prev + PAGE_LIMIT);
  };

  const hasMore = pageNotices && pageNotices.length === PAGE_LIMIT;

  const notices = pages;

  const toggleExpanded = (noticeId: string) => {
    const newExpanded = new Set(expandedNotices);
    if (newExpanded.has(noticeId)) {
      newExpanded.delete(noticeId);
    } else {
      newExpanded.add(noticeId);
    }
    setExpandedNotices(newExpanded);
  };

  const getDisplayContent = (content: string, noticeId: string) => {
    const isExpanded = expandedNotices.has(noticeId);
    
    if (isExpanded) {
      return content;
    }
    
    // Show only first 2 lines worth of text (truncate at approximately 200 characters for 2 lines)
    const charLimit = 200;
    if (content.length > charLimit) {
      return content.substring(0, charLimit) + '...';
    }
    
    return content;
  };

  const shouldShowReadMore = (content: string) => {
    // Show Read More if content is longer than ~200 characters (roughly 2 lines)
    return content.length > 200;
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
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notices</h1>
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
        {isLoading && pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-yellow-600 mb-3" />
            <p className="text-muted-foreground">Loading notices...</p>
          </div>
        ) : notices.length === 0 ? (
          <Card className="border-2 border-dashed shadow-lg">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Bell className="h-16 w-16 text-yellow-200 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Notices Available</h3>
              <p className="text-muted-foreground max-w-sm">There are no notices at the moment. Check back soon for updates!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {notices.map((notice: any) => (
              <Card key={notice.id} className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl text-gray-900 break-words">{notice.heading}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{format(new Date(notice.createdAt), "MMMM d, yyyy h:mm a")}</p>
                    </div>
                    {notice.pdfUrl && (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => { const link = document.createElement("a"); link.href = notice.pdfUrl!; link.download = "notice.pdf"; link.click(); }}>
                        <Download className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{getDisplayContent(notice.content, notice.id)}</p>
                  {shouldShowReadMore(notice.content) && (
                    <button
                      onClick={() => toggleExpanded(notice.id)}
                      className="mt-3 text-sm font-semibold text-yellow-600 hover:text-yellow-700 transition-colors"
                    >
                      {expandedNotices.has(notice.id) ? "Read Less" : "Read More"}
                    </button>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Load More Section */}
            {hasMore && (
              <div className="flex justify-center pt-8">
                <Button onClick={handleLoadMore} disabled={isLoadingMore} className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 shadow-lg" size="lg">
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Notices
                      <span className="ml-2 text-sm opacity-90">(next {PAGE_LIMIT})</span>
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Completion Message */}
            {!hasMore && notices.length > 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">✓ You're all caught up! You've seen all {notices.length} notice{notices.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
