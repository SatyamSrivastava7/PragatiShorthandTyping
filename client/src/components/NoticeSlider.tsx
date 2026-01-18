import { useState, useEffect } from "react";
import { useNotices } from "@/lib/hooks/useNotice";
import { Button } from "@/components/ui/button";
import { X, Bell, Download, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export function NoticeSlider() {
  const { notices } = useNotices();
  const [isVisible, setIsVisible] = useState(true);
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(0); // Start with latest (first element)

  // Auto-hide after 10 seconds if there are notices
  useEffect(() => {
    if (notices.length > 0 && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notices, isVisible]);

  if (notices.length === 0 || !isVisible) {
    return null;
  }

  const currentNotice = notices[currentNoticeIndex]; // Notices already sorted latest first from API

  const handleNext = () => {
    setCurrentNoticeIndex((prev) => (prev + 1) % notices.length);
  };

  const handlePrevious = () => {
    setCurrentNoticeIndex(
      (prev) => (prev - 1 + notices.length) % notices.length
    );
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 animate-in slide-in-from-bottom duration-500",
        "bg-gradient-to-r from-yellow-50 to-amber-50 border-t-2 border-yellow-400 shadow-2xl"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          {/* Notice Content */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-1 shrink-0">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-yellow-900 text-sm sm:text-base mb-1 break-words">
                {currentNotice.heading}
              </h3>
              <p className="text-xs sm:text-sm text-yellow-800 line-clamp-2 break-words">
                {currentNotice.content}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {currentNotice.pdfUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs sm:text-sm text-yellow-700 hover:text-yellow-900 p-0 h-auto"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = currentNotice.pdfUrl!;
                      link.download = "notice.pdf";
                      link.click();
                    }}
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Download PDF
                  </Button>
                )}
                <Link href="/notice">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs sm:text-sm text-yellow-700 hover:text-yellow-900 p-0 h-auto"
                  >
                    View All Notices
                    <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notice Counter */}
            {notices.length > 1 && (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={handlePrevious}
                  className="p-1 hover:bg-yellow-200 rounded transition-colors"
                  aria-label="Previous notice"
                >
                  <span className="text-xs font-semibold text-yellow-700">←</span>
                </button>
                <span className="text-xs font-medium text-yellow-700 min-w-12 text-center">
                  {currentNoticeIndex + 1}/{notices.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 hover:bg-yellow-200 rounded transition-colors"
                  aria-label="Next notice"
                >
                  <span className="text-xs font-semibold text-yellow-700">→</span>
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-yellow-200 rounded transition-colors shrink-0"
              aria-label="Close notice"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-700" />
            </button>
          </div>
        </div>

        {/* Mobile controls (shown only on small screens if multiple notices) */}
        {notices.length > 1 && (
          <div className="sm:hidden flex items-center justify-center gap-2 mt-3">
            <button
              onClick={handlePrevious}
              className="px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs font-medium text-yellow-700">
              {currentNoticeIndex + 1}/{notices.length}
            </span>
            <button
              onClick={handleNext}
              className="px-3 py-1 text-xs font-semibold text-yellow-700 hover:bg-yellow-200 rounded transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
